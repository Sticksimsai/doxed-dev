// Fills an empty database with the demo data from src/lib/mock.ts (flagged is_demo,
// so background jobs never try to fetch live data for these fake mints).
import { sql } from "./db";
import { DEVS, TOKENS } from "../src/lib/mock";

export async function seedDemo() {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from launches`;
  if (n > 0) return;
  const [cleared] = await sql<{ value: string }[]>`select value from app_settings where key = 'demo_cleared'`;
  if (cleared) return; // an admin removed the demo data — don't bring it back
  console.log("[seed] inserting demo data");
  const idMap = new Map<string, string>();
  await sql.begin(async (tx) => {
    for (const d of DEVS) {
      const [k] = await tx<{ dev_id: string }[]>`
        insert into dev_kyc_private (provider, provider_applicant_id, status, legal_name, country, checks, verified_at)
        values ('demo', ${"demo-" + d.id}, 'approved', ${d.revealed.name ?? "Demo Dev"}, ${d.revealed.region ?? null},
                ${tx.json({ identity: d.checks.identity, liveness: d.checks.liveness, screening: d.checks.screening })}, ${d.verifiedAt})
        returning dev_id`;
      idMap.set(d.id, k.dev_id);
      await tx`
        insert into dev_profiles (dev_id, alias, wallet, disclosure, x_handle, x_verified, github_login, github_verified,
                                  reveal_name, reveal_region, bio, is_demo)
        values (${k.dev_id}, ${d.alias}, ${d.wallet}, ${d.disclosure}, ${d.revealed.x ?? null}, ${d.checks.x}, ${d.revealed.github ?? null},
                ${d.checks.github}, ${!!d.revealed.name}, ${!!d.revealed.region}, ${d.revealed.bio ?? null}, true)`;
    }
    for (const t of TOKENS) {
      await tx`
        insert into launches (mint, dev_id, launchpad, name, symbol, description, x_url, website_url, github_repo, stage, is_demo, created_at, tax_bps)
        values (${t.mint}, ${idMap.get(t.devId)!}, ${t.launchpad}, ${t.name}, ${t.symbol}, ${t.description}, ${t.links.x ?? null},
                ${t.links.website ?? null}, ${t.links.github?.replace("https://github.com/", "") ?? null}, ${t.stage}, true, ${t.createdAt}, ${t.taxPct ? t.taxPct * 100 : null})`;
      await tx`
        insert into locks (mint, contract, amount, pct_of_supply, starts_at, unlocks_at, verified_onchain_at)
        values (${t.mint}, ${t.lock.contract}, ${t.lock.amount}, ${t.lock.pctOfSupply}, ${t.lock.startsAt}, ${t.lock.unlocksAt}, now())`;
      await tx`
        insert into market (mint, mcap, liquidity, volume24h, holders, total_supply, change_5m, change_1h, change_6h, change_24h,
                            top_holders_pct, mint_authority_off, freeze_authority_off, bonding_pct)
        values (${t.mint}, ${t.mcap}, ${t.liquidity}, ${t.volume24h}, ${t.holders}, ${t.totalSupply}, ${t.change["5m"]}, ${t.change["1h"]},
                ${t.change["6h"]}, ${t.change["24h"]}, ${t.topHoldersPct}, true, true, ${t.bondingPct})`;
      const start = Date.now() - t.series.length * 3_600_000;
      for (let i = 0; i < t.series.length; i++)
        await tx`insert into market_snapshots (mint, at, price) values (${t.mint}, ${new Date(start + i * 3_600_000)}, ${t.series[i]})`;
      for (const c of t.feeClaims)
        await tx`insert into fee_claims (signature, mint, claimed_at, amount_sol) values (${c.signature}, ${t.mint}, ${c.at}, ${c.amountSol})`;
      if (t.ai)
        await tx`insert into ai_summaries (mint, tldr, points, recent, watchouts, sources, updated_at)
                 values (${t.mint}, ${t.ai.tldr}, ${tx.json(t.ai.points)}, ${tx.json(t.ai.recent)}, ${tx.json(t.ai.watchouts)},
                         ${tx.json(t.ai.sources as never)}, ${t.ai.updatedAt})`;
      if (t.repo)
        await tx`insert into repo_analyses (mint, repo, score, verdict, stats, languages, findings, updated_at)
                 values (${t.mint}, ${t.repo.repo}, ${t.repo.score}, ${t.repo.verdict},
                         ${tx.json({ stars: t.repo.stars, contributors: t.repo.contributors, commits30d: t.repo.commits30d, lastCommit: t.repo.lastCommit })},
                         ${tx.json(t.repo.languages)}, ${tx.json(t.repo.findings as never)}, ${t.repo.updatedAt})`;
    }
  });
}
