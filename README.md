# Vouch (working name)

A trust layer on top of Solana launchpads. Devs launch natively on Pump.fun, Raydium LaunchLab, LetsBonk, Meteora DBC (Float soon) — but only after:

1. **Know Your Dev** — private identity verification. Public sees a badge + which checks passed; the dev chooses what else to reveal (private → socials → public name). Disclosure can only go up.
2. **Dev lock** — 100% of the dev's launch tokens locked on Streamflow, minimum 12 months. Token isn't listed/badged until the lock confirms on-chain.

Discover shows every token with an AI summary (X + website, refreshed regularly), an AI GitHub code review when a repo is linked, creator-fee claim history, and the lock card.

## Run
```
npm install
npm run dev            # http://localhost:5173
npm run build          # production build -> dist/
npm run build:preview  # one self-contained HTML -> dist-preview/index.html
```
Change the name in `src/lib/brand.ts`.

## Structure
- `src/lib/types.ts` – domain types (Token, Dev, Lock, FeeClaim, AiSummary, RepoAnalysis)
- `src/lib/api.ts` – **the only data seam**. Currently returns `mock.ts`; swap each function for Supabase / server calls.
- `src/pages/` – discover, token, dev, launch (5-step wizard), how-it-works
- `src/components/ui.tsx` – badges, chips, charts, lock progress, redacted fields
- `supabase/migrations/0001_kyd_launchpad.sql` – schema with private KYC table + public view

## Porting from EZ Screener
These files from the old project plug straight into `api.ts`:
| Feature | Old file |
|---|---|
| Fee claim history | `src/lib/dev-fees.server.ts` (Helius enhanced txs) |
| Lock detection | `src/lib/locked-supply.server.ts` (Streamflow) |
| AI GitHub review | `src/lib/github-dd.server.ts`, `github-dd-llm.server.ts` |
| AI summary | `src/lib/token-summary.functions.ts`, `token-tweets.server.ts` |
| Wallet auth | `src/lib/privy*.ts`, `phantom-siws.ts` |

## Still to build
- KYC provider integration (webhook -> `dev_kyc_private`)
- Launchpad adapters (create + dev buy per launchpad SDK), then Streamflow lock tx
- Indexer cron: market data, fee claims, lock verification, AI refresh
