// Background refreshers. Each run is small and idempotent; failures are logged, never fatal.
import { sql } from "./db";
import { env } from "./env";
import { fetchAsset, toMarketRow } from "./lib/market";
import { devFeeClaims } from "./lib/solana";
import { verifyLock } from "./lib/launch";
import { syncFromDidit } from "./lib/kyd";
import { unclaimedCreatorFeeSol } from "./lib/meteora";
import { aiReady, pageText, recentPosts, reviewRepo, summariseProject } from "./lib/ai";
import { parseRepo, repoFacts } from "./lib/github";

const log = (job: string, ...a: unknown[]) => console.log(`[job:${job}]`, ...a);

export async function refreshMarket() {
  const rows = await sql<{ mint: string }[]>`select mint from launches where not is_demo and stage in ('pending_lock','bonding','graduated')`;
  for (const { mint } of rows) {
    const a = await fetchAsset(mint);
    if (!a) continue;
    const m = toMarketRow(a);
    await sql`
      insert into market (mint, mcap, liquidity, volume24h, holders, total_supply, change_5m, change_1h, change_6h, change_24h,
                          top_holders_pct, mint_authority_off, freeze_authority_off, bonding_pct, updated_at)
      values (${mint}, ${m.mcap}, ${m.liquidity}, ${m.volume24h}, ${m.holders}, ${m.total_supply}, ${m.change_5m}, ${m.change_1h},
              ${m.change_6h}, ${m.change_24h}, ${m.top_holders_pct}, ${m.mint_authority_off}, ${m.freeze_authority_off}, ${m.bonding_pct}, now())
      on conflict (mint) do update set mcap = excluded.mcap, liquidity = excluded.liquidity, volume24h = excluded.volume24h,
        holders = excluded.holders, total_supply = excluded.total_supply, change_5m = excluded.change_5m, change_1h = excluded.change_1h,
        change_6h = excluded.change_6h, change_24h = excluded.change_24h, top_holders_pct = excluded.top_holders_pct,
        mint_authority_off = excluded.mint_authority_off, freeze_authority_off = excluded.freeze_authority_off,
        bonding_pct = excluded.bonding_pct, updated_at = now()`;
    if (m.price != null) await sql`insert into market_snapshots (mint, price, mcap) values (${mint}, ${m.price}, ${m.mcap}) on conflict do nothing`;
    if (m.graduated_pool) await sql`update launches set graduated_pool = ${m.graduated_pool}, stage = 'graduated' where mint = ${mint} and stage = 'bonding'`;
  }
  await sql`delete from market_snapshots where at < now() - interval '30 days'`;
}

export async function refreshFees() {
  if (!env.heliusKey) return;
  const rows = await sql<{ mint: string; wallet: string; launchpad: string; stage: string; pool_address: string | null; graduated_pool: string | null }[]>`
    select l.mint, p.wallet, l.launchpad, l.stage, l.pool_address, l.graduated_pool from launches l join dev_profiles p using (dev_id)
    where not l.is_demo and l.stage in ('bonding','graduated')`;
  for (const r of rows) {
    const pools = [r.pool_address, r.graduated_pool].filter(Boolean) as string[];
    const claims = await devFeeClaims(r.wallet, pools.length ? pools : [r.mint], 5, r.mint);
    if (r.launchpad === "meteora" && r.pool_address && r.stage === "bonding") {
      const unclaimed = await unclaimedCreatorFeeSol(r.pool_address).catch(() => null);
      if (unclaimed != null) await sql`update launches set fees_unclaimed_sol = ${unclaimed} where mint = ${r.mint}`;
    }
    for (const c of claims)
      await sql`insert into fee_claims (signature, mint, claimed_at, amount_sol, amount_usdc, claimer)
                values (${c.signature}, ${r.mint}, ${c.at}, ${c.amountSol}, ${c.amountUsdc}, ${c.claimer}) on conflict do nothing`;
  }
}

export async function refreshAi(limit = 3) {
  if (!aiReady()) return;
  const due = await sql`
    select l.*, d.disclosure from launches l join dev_public_profiles d using (dev_id)
    left join ai_summaries a using (mint)
    where not l.is_demo and l.stage in ('bonding','graduated') and (a.updated_at is null or a.updated_at < now() - interval '6 hours')
    order by a.updated_at nulls first limit ${limit}`;
  for (const l of due) {
    try {
      const repo = parseRepo(l.github_repo);
      const [websiteText, posts, facts] = await Promise.all([
        l.website_url ? pageText(l.website_url) : Promise.resolve(""),
        l.x_url ? recentPosts(l.x_url) : Promise.resolve([]),
        repo ? repoFacts(repo) : Promise.resolve(null),
      ]);
      const s = await summariseProject({
        name: l.name, symbol: l.symbol, description: l.description, website: l.website_url ?? undefined,
        websiteText, posts, readme: facts?.readme, disclosure: l.disclosure,
      });
      const sources = [
        l.x_url && { kind: "x", label: "@" + String(l.x_url).split("/").filter(Boolean).pop(), url: l.x_url },
        l.website_url && { kind: "web", label: String(l.website_url).replace(/^https?:\/\//, ""), url: l.website_url },
        repo && { kind: "github", label: repo, url: `https://github.com/${repo}` },
      ].filter(Boolean);
      await sql`
        insert into ai_summaries (mint, tldr, points, recent, watchouts, sources, updated_at)
        values (${l.mint}, ${s.tldr}, ${sql.json(s.points)}, ${sql.json(s.recent ?? [])}, ${sql.json(s.watchouts ?? [])}, ${sql.json(sources as never)}, now())
        on conflict (mint) do update set tldr = excluded.tldr, points = excluded.points, recent = excluded.recent,
          watchouts = excluded.watchouts, sources = excluded.sources, updated_at = now()`;

      const lastReview = await sql`select updated_at from repo_analyses where mint = ${l.mint} and updated_at > now() - interval '24 hours'`;
      if (facts && !lastReview.length) {
        const r = await reviewRepo(facts);
        const stats = { stars: facts.stars, contributors: facts.contributors, commits30d: facts.commits30d, lastCommit: facts.lastCommit };
        await sql`
          insert into repo_analyses (mint, repo, score, verdict, stats, languages, findings, updated_at)
          values (${l.mint}, ${facts.repo}, ${r.score}, ${r.verdict}, ${sql.json(stats)}, ${sql.json(facts.languages)}, ${sql.json(r.findings)}, now())
          on conflict (mint) do update set repo = excluded.repo, score = excluded.score, verdict = excluded.verdict, stats = excluded.stats,
            languages = excluded.languages, findings = excluded.findings, updated_at = now()`;
      }
      log("ai", "updated", l.symbol);
    } catch (err) {
      log("ai", "failed", l.symbol, (err as Error).message);
    }
  }
}

/** Fallback for missed Didit webhooks: re-check open verification sessions. */
export async function sweepVerifications() {
  const rows = await sql<{ dev_id: string }[]>`
    select dev_id from dev_kyc_private where status = 'in_progress' and updated_at < now() - interval '2 minutes'
    and updated_at > now() - interval '2 days' limit 20`;
  for (const r of rows) await syncFromDidit(r.dev_id).catch(() => null);
}

/** Picks up launches whose dev has locked on-chain but hasn't pressed "verify". */
export async function sweepPendingLocks() {
  const rows = await sql<{ mint: string; wallet: string; lock_months: number }[]>`
    select l.mint, p.wallet, l.lock_months from launches l join dev_profiles p using (dev_id)
    where l.stage = 'pending_lock' and not l.is_demo and l.created_at > now() - interval '7 days'`;
  for (const r of rows) await confirmLock(r.mint, r.wallet, r.lock_months).catch(() => null);
}

export async function confirmLock(mint: string, wallet: string, months: number) {
  const [l] = await sql`select lock_contract from launches where mint = ${mint}`;
  const res = await verifyLock(mint, wallet, months, l?.lock_contract ? [l.lock_contract] : []);
  if (!res.ok) return res;
  await sql.begin(async (tx) => {
    await tx`
      insert into locks (mint, contract, amount, pct_of_supply, starts_at, unlocks_at, verified_onchain_at)
      values (${mint}, ${res.contract}, ${res.amount}, ${res.pctOfSupply}, ${res.startsAt}, ${res.unlocksAt}, now())
      on conflict (mint) do update set contract = excluded.contract, amount = excluded.amount, unlocks_at = excluded.unlocks_at,
        verified_onchain_at = now()`;
    await tx`update launches set stage = 'bonding' where mint = ${mint} and stage = 'pending_lock'`;
  });
  return res;
}

function every(name: string, ms: number, fn: () => Promise<unknown>) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      log(name, "error", (err as Error).message);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 5_000);
  setInterval(run, ms);
}

export function startJobs() {
  if (!env.jobs) return log("all", "disabled (RUN_JOBS=false)");
  every("market", 60_000, refreshMarket);
  every("locks", 5 * 60_000, sweepPendingLocks);
  if (env.kydProvider === "didit") every("kyd", 3 * 60_000, sweepVerifications);
  every("fees", 15 * 60_000, refreshFees);
  every("ai", 10 * 60_000, () => refreshAi());
  if (!env.heliusKey) log("fees", "HELIUS_API_KEY missing — fee claims disabled, public RPC used for lock checks");
  if (!aiReady()) log("ai", "no AI key (ANTHROPIC_API_KEY or OPENROUTER_API_KEY) — AI summaries disabled");
}
