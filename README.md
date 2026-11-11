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

## How a launch works
1. **Sign in** — wallet signs a one-time message (`/api/auth/nonce` → `/api/auth/verify`), httpOnly session cookie.
2. **Get doxed** — `/api/kyd/start`. In webhook mode the dev is sent to your KYC provider; the result comes back on
   `/api/kyd/webhook` (HMAC-signed). Raw identity data lives only in `dev_kyc_private`; the public reads the
   `dev_public_profiles` view, which applies the dev's disclosure choice. Disclosure can only go up (DB trigger).
3. **Create the token** on the chosen launchpad from the same wallet, then register it — `POST /api/launches`.
4. **Lock** 100% of the dev wallet's tokens on Streamflow for ≥ 12 months, then `POST /api/launches/:mint/verify-lock`
   (also re-checked automatically for 7 days). The dev wallet must hold 0 tokens and the stream must be sent from it.
   Only then is the token listed.

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
- In-app token creation per launchpad (today the dev creates on the launchpad, then registers the mint)
- A real KYC provider adapter (mock provider is on for staging via `ALLOW_MOCK_KYD`)
- Proof of X / GitHub account ownership (fields exist, verification flow pending)
- Image upload storage
