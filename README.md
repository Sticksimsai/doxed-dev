# Doxed Dev

A trust layer on top of Solana launchpads (Pump.fun, Raydium LaunchLab, LetsBonk, Meteora DBC).
Devs get **doxed privately** before launching, and **100% of their tokens are locked for 12+ months** on Streamflow.
Discover shows every token with an AI summary (X + website), an AI GitHub review, creator-fee claim history and the lock.

## Stack
- **Frontend:** React 19 + Vite + Tailwind v4 + TanStack Router/Query (`src/`)
- **Backend:** Hono on Node 22 + Postgres (`server/`), one process serving `/api` and the built frontend
- **Chain:** Helius / Solana RPC, Streamflow lock detection, Jupiter market data
- **AI:** Anthropic API

## Run locally
```bash
cp .env.example .env             # set DATABASE_URL at minimum
npm install
npm run dev:server               # API on :8787 (migrates + seeds demo data on first run)
npm run dev                      # UI on :5173, proxies /api to :8787
```
`npm run build:preview` makes a single-file demo (mock data, no backend).

## How a launch works (all in-app)
1. **Sign in** — the wallet signs a one-time message; httpOnly session cookie.
2. **Get doxed** — `POST /api/kyd/start` opens a Didit session, shown in an iframe: **scan ID → face scan**.
   Didit runs document-fraud checks, passive liveness (photos, screens, masks, deepfakes) and face match.
   Its signed webhook (`/api/kyd/didit/webhook`, X-Signature-V2) triggers our decision engine (`server/lib/risk.ts`):
   hard rules (genuine doc, liveness ≥ 70, face match ≥ 70, 18+, not expired) → duplicate-ID guard (one-way HMAC of
   document number) → **AI risk check** on the signals (no images, no document numbers), which can only escalate to
   human review. Held cases appear at `/admin` for wallets in `ADMIN_WALLETS`.
3. **Launch** (Pump.fun or LetsBonk) — one button:
   metadata → IPFS · `create-tx` (PumpPortal builds create + dev buy; server pre-signs with a fresh mint key) ·
   wallet approves · confirm · `lock-tx` (Streamflow lock of 100% of the dev wallet's balance, non-cancellable) ·
   wallet approves · `verify-lock` (SDK-decoded: sender, mint, no cancel/top-up, unlock ≥ term, dev wallet empty) → listed.
   Raydium LaunchLab / Meteora: create on the launchpad, then register with `POST /api/launches` (in-app coming).

## Setup checklist
| Variable | What for |
|---|---|
| `DIDIT_API_KEY` | Didit console → API keys (500 free verifications/month) |
| `DIDIT_WORKFLOW_ID` | Run `DIDIT_API_KEY=… npm run didit:setup` once, or create a KYC workflow in the console (ID + passive liveness + face match + IP) |
| `DIDIT_WEBHOOK_SECRET` | Didit console → Webhooks → add `https://<your-domain>/api/kyd/didit/webhook`, copy the secret |
| `PINATA_JWT` | Pinata → API keys (Pump.fun metadata on IPFS). LetsBonk needs nothing. |
| `ADMIN_WALLETS` | Comma-separated wallets that can approve held verifications at `/admin` |
| `HELIUS_API_KEY` | Reliable RPC for launches + fee-claim history (strongly recommended) |
| `ANTHROPIC_API_KEY` | AI risk check on verifications + AI project summaries |
| `OPENROUTER_API_KEY` | Master key behind the Builder API (set a hard limit on it in its dashboard) |
| `LAUNCH_FEE_SOL` + `TREASURY_WALLET` | Platform fee collected in the lock transaction (shown to devs before they launch). Off until both are set. |
| `KYD_FRAME_ORIGIN` | Origin of the embedded ID-scan page, if you move it to your own subdomain (default: the provider's) |

## Builder API (per-dev AI keys)
Doxed devs create up to 5 `dxd_…` keys at `/builder`. The server proxies them to one master OpenRouter key.
- **Endpoint:** OpenAI-compatible at `https://<host>/api/v1` — `POST /chat/completions` (streaming supported), `GET /models`, `GET /key` (remaining credit).
- **Security:** keys stored as SHA-256 hashes only, shown once; revoked instantly; stop working if the dev is flagged or not approved.
- **Metering:** every request's real cost comes from OpenRouter's `usage.cost` (or the generation lookup if a stream is cut off) and is logged in `builder_usage`.
- **Limits:** monthly credit per dev (`BUILDER_MONTHLY_CREDIT_USD`, default $100, override per dev in `dev_profiles.builder_credit_usd`),
  `BUILDER_RPM` per key (60), `BUILDER_MAX_TOKENS` output cap (8192), optional `BUILDER_MODELS` allowlist.
- **Setup:** set `OPENROUTER_API_KEY`. Put a hard credit limit on that key in the OpenRouter dashboard as a backstop.

## Background jobs (`server/jobs.ts`)
| Job | Every | Needs |
|---|---|---|
| Market data + price snapshots | 1 min | — (Jupiter) |
| Pending lock sweep | 5 min | — (Helius recommended) |
| Creator fee claims | 15 min | `HELIUS_API_KEY` |
| AI summary (6h) + repo review (24h) | 10 min | `ANTHROPIC_API_KEY` |

## API
`GET /api/tokens` · `GET /api/tokens/:mint` · `GET /api/devs/:id` · `GET /api/launchpads` · `GET /api/me` ·
`POST /api/auth/nonce|verify|logout` · `POST /api/kyd/start` · `POST /api/kyd/webhook` · `PATCH /api/me/profile` ·
`POST /api/launches` · `POST /api/launches/:mint/verify-lock` · `GET /api/me/launches` · `GET /api/health`

## Deploy (Render)
`render.yaml` defines the web service and a Postgres database. Add `HELIUS_API_KEY` and `ANTHROPIC_API_KEY` in the
dashboard to switch on fee tracking and AI.

## Not built yet
- In-app creation for Raydium LaunchLab and Meteora DBC
- Proof of X / GitHub account ownership (fields exist, verification flow pending)
- Image upload storage

## White-labelling
Users only ever see Doxed Dev. Provider names are kept out of the UI, API responses and error messages:
the Builder API rewrites response ids (`dxd-…`), strips upstream-only fields, neutralises stream keep-alives and scrubs
upstream names from errors; `/v1/models` is re-shaped to a neutral schema. The only third-party surface left is the
embedded ID-scan page — turn on white-label branding and a custom domain in the verification provider's console,
then set `KYD_FRAME_ORIGIN`. Launchpad names (Pump.fun, LetsBonk…) are shown on purpose — devs pick them. Block-explorer
links are kept so anyone can verify locks and fee claims on-chain.

## Going live checklist

Open **/admin → Setup** (needs your wallet in `ADMIN_WALLETS`). It live-checks every connection and shows which keys are missing.
Paste keys in Render → doxed-dev → Environment; blank or `paste-here` values count as "not set".

| Key | Unlocks |
| --- | --- |
| `ADMIN_WALLETS` | /admin — setup checklist + review queue |
| `OPENROUTER_API_KEY` | Builder API, and AI summaries / repo reviews / fake-ID check when there's no Anthropic key |
| `HELIUS_API_KEY` | Fee-claim history, reliable lock checks + transaction sending |
| `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET` | Real ID scan → face scan (workflow is created automatically) |
| `PINATA_JWT` | Pump.fun launches (LetsBonk works without it) |
| `LAUNCH_FEE_SOL`, `TREASURY_WALLET` | Platform launch fee |
| `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `X_BEARER_TOKEN` | Optional |

After real verification is on: set `ALLOW_MOCK_KYD=false`, `SEED_DEMO=false`, and press **Remove demo data** on the Setup page.
