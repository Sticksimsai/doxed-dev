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
