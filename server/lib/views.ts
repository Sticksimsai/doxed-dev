// Turns database rows into the exact shapes the frontend uses (src/lib/types.ts).
import { sql } from "../db";
import type { Dev, Disclosure, LaunchpadId, Token } from "../../src/lib/types";

const num = (v: unknown) => (v == null ? null : Number(v));
const hueOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

type Row = Record<string, any>;

const TOKEN_SELECT = sql`
  select l.*, m.mcap, m.liquidity, m.volume24h, m.holders, m.total_supply, m.change_5m, m.change_1h, m.change_6h,
         m.change_24h, m.top_holders_pct, m.mint_authority_off, m.freeze_authority_off, m.bonding_pct,
         k.contract as lock_contract, k.amount as lock_amount, k.pct_of_supply as lock_pct, k.starts_at as lock_start,
         k.unlocks_at as lock_end,
         a.tldr, a.points, a.recent, a.watchouts, a.sources, a.updated_at as ai_updated,
         r.repo as r_repo, r.score as r_score, r.verdict as r_verdict, r.stats as r_stats, r.languages as r_langs,
         r.findings as r_findings, r.updated_at as r_updated
  from launches l
  join dev_public_profiles d on d.dev_id = l.dev_id
  join locks k on k.mint = l.mint
  left join market m on m.mint = l.mint
  left join ai_summaries a on a.mint = l.mint
  left join repo_analyses r on r.mint = l.mint
  where l.stage in ('bonding', 'graduated')`;

async function seriesFor(mints: string[]) {
  if (!mints.length) return new Map<string, number[]>();
  const rows = await sql<{ mint: string; price: string }[]>`
    select mint, price from market_snapshots
    where mint in ${sql(mints)} and at > now() - interval '7 days' and price is not null
    order by at`;
  const map = new Map<string, number[]>();
  for (const r of rows) {
    const arr = map.get(r.mint) ?? [];
    arr.push(Number(r.price));
    map.set(r.mint, arr);
  }
  return map;
}

async function claimsFor(mints: string[]) {
  if (!mints.length) return new Map<string, Token["feeClaims"]>();
  const rows = await sql<{ mint: string; signature: string; claimed_at: Date; amount_sol: string }[]>`
    select mint, signature, claimed_at, amount_sol from fee_claims where mint in ${sql(mints)} order by claimed_at desc`;
  const map = new Map<string, Token["feeClaims"]>();
  for (const r of rows) {
    const arr = map.get(r.mint) ?? [];
    arr.push({ signature: r.signature, at: r.claimed_at.toISOString(), amountSol: Number(r.amount_sol ?? 0) });
    map.set(r.mint, arr);
  }
  return map;
}

function toToken(r: Row, series: number[] | undefined, claims: Token["feeClaims"] | undefined): Token {
  const supply = num(r.total_supply) ?? 1_000_000_000;
  const s = series && series.length > 1 ? series : [1, 1];
  return {
    mint: r.mint,
    name: r.name,
    symbol: r.symbol,
    hue: hueOf(r.mint),
    launchpad: r.launchpad as LaunchpadId,
    devId: r.dev_id,
    createdAt: new Date(r.created_at).toISOString(),
    stage: r.stage === "graduated" ? "graduated" : "bonding",
    bondingPct: Math.round(num(r.bonding_pct) ?? (r.stage === "graduated" ? 100 : 0)),
    mcap: num(r.mcap) ?? 0,
    liquidity: num(r.liquidity) ?? 0,
    volume24h: num(r.volume24h) ?? 0,
    holders: num(r.holders) ?? 0,
    change: { "5m": num(r.change_5m) ?? 0, "1h": num(r.change_1h) ?? 0, "6h": num(r.change_6h) ?? 0, "24h": num(r.change_24h) ?? 0 },
    description: r.description ?? "",
    links: { x: r.x_url ?? undefined, website: r.website_url ?? undefined, github: r.github_repo ? `https://github.com/${r.github_repo}` : undefined },
    totalSupply: supply,
    topHoldersPct: Math.round(num(r.top_holders_pct) ?? 0),
    mintAuthorityOff: r.mint_authority_off ?? true,
    freezeAuthorityOff: r.freeze_authority_off ?? true,
    lock: {
      provider: "Streamflow",
      contract: r.lock_contract,
      amount: Number(r.lock_amount),
      pctOfDevAllocation: 100,
      pctOfSupply: num(r.lock_pct) ?? Math.round((Number(r.lock_amount) / supply) * 1e4) / 100,
      startsAt: new Date(r.lock_start).toISOString(),
      unlocksAt: new Date(r.lock_end).toISOString(),
      termMonths: Math.round((+new Date(r.lock_end) - +new Date(r.lock_start)) / (30.44 * 864e5)),
    },
    feeClaims: claims ?? [],
    feesUnclaimedSol: null,
    ai: r.tldr
      ? { tldr: r.tldr, points: r.points, recent: r.recent, watchouts: r.watchouts, sources: r.sources, updatedAt: new Date(r.ai_updated).toISOString() }
      : undefined,
    repo: r.r_repo
      ? {
          repo: r.r_repo,
          score: r.r_score,
          verdict: r.r_verdict,
          stars: r.r_stats.stars ?? 0,
          contributors: r.r_stats.contributors ?? 0,
          commits30d: r.r_stats.commits30d ?? 0,
          lastCommit: r.r_stats.lastCommit ?? new Date(r.r_updated).toISOString(),
          languages: r.r_langs,
          findings: r.r_findings,
          updatedAt: new Date(r.r_updated).toISOString(),
        }
      : undefined,
    series: s,
  };
}

export async function listTokens(): Promise<Token[]> {
  const rows = await sql`${TOKEN_SELECT} order by m.mcap desc nulls last limit 500`;
  const mints = rows.map((r) => r.mint as string);
  const [series, claims] = await Promise.all([seriesFor(mints), claimsFor(mints)]);
  return rows.map((r) => toToken(r, series.get(r.mint), claims.get(r.mint)));
}

export async function getToken(mint: string): Promise<Token | null> {
  const rows = await sql`${TOKEN_SELECT} and l.mint = ${mint}`;
  if (!rows.length) return null;
  const [series, claims] = await Promise.all([seriesFor([mint]), claimsFor([mint])]);
  return toToken(rows[0], series.get(mint), claims.get(mint));
}

export async function listDevs(where = sql``): Promise<Dev[]> {
  const rows = await sql`
    select d.*,
      (select count(*) from launches l where l.dev_id = d.dev_id and l.stage in ('bonding','graduated'))::int as n_launches,
      (select count(*) from locks k join launches l using (mint) where l.dev_id = d.dev_id and k.verified_onchain_at is not null)::int as n_locks,
      (select count(*) from launches l where l.dev_id = d.dev_id and l.stage = 'flagged')::int as n_broken,
      (select coalesce(sum(f.amount_sol), 0) from fee_claims f join launches l using (mint) where l.dev_id = d.dev_id) as fees
    from dev_public_profiles d ${where}`;
  return rows.map((r) => ({
    id: r.dev_id,
    alias: r.alias,
    wallet: r.wallet,
    disclosure: r.disclosure as Disclosure,
    checks: r.checks,
    verifiedAt: new Date(r.verified_at).toISOString(),
    revealed: {
      name: r.legal_name ?? undefined,
      x: r.x_handle ?? undefined,
      github: r.github_login ?? undefined,
      region: r.region ?? undefined,
      bio: r.bio ?? undefined,
    },
    stats: { launches: r.n_launches, locksHonored: r.n_locks, locksBroken: r.n_broken, totalFeesClaimedSol: Number(r.fees) },
  }));
}

export async function listDevsByIds(ids: string[]) {
  return ids.length ? listDevs(sql`where d.dev_id in ${sql(ids)}`) : [];
}

export async function tokensByDev(devId: string): Promise<Token[]> {
  return (await listTokens()).filter((t) => t.devId === devId);
}

export const getDev = async (id: string) =>
  /^[0-9a-f-]{36}$/i.test(id) ? ((await listDevs(sql`where d.dev_id = ${id}`))[0] ?? null) : null;
