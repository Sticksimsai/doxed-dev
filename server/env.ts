// Central config. Everything except DATABASE_URL is optional: features whose
// keys are missing are skipped (and logged) instead of crashing the server.
import { randomBytes } from "node:crypto";

const e = process.env;

export const env = {
  port: Number(e.PORT ?? 8787),
  databaseUrl: e.DATABASE_URL ?? "",
  isProd: e.NODE_ENV === "production",
  /** Signs session cookies. Set a long random value in production. */
  sessionSecret: e.SESSION_SECRET ?? randomBytes(32).toString("hex"),
  /** Solana RPC + enhanced transactions. */
  heliusKey: e.HELIUS_API_KEY ?? "",
  /** AI summaries + repo reviews. */
  anthropicKey: e.ANTHROPIC_API_KEY ?? "",
  aiModel: e.AI_MODEL ?? "claude-sonnet-5-5",
  /** Optional: higher GitHub rate limits for repo reviews. */
  githubToken: e.GITHUB_TOKEN ?? "",
  /** Optional: read recent posts from the project's X account. */
  xBearer: e.X_BEARER_TOKEN ?? "",
  /** Public base URL (Render sets RENDER_EXTERNAL_URL automatically). */
  publicUrl: (e.PUBLIC_URL ?? e.RENDER_EXTERNAL_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  /** Identity provider: "didit" (ID scan + face scan) or "mock" (instant approve, staging only). */
  kydProvider: (!e.KYD_PROVIDER || e.KYD_PROVIDER === "auto" ? (e.DIDIT_API_KEY ? "didit" : "mock") : e.KYD_PROVIDER) as "mock" | "didit" | "webhook",
  diditApiKey: e.DIDIT_API_KEY ?? "",
  diditWorkflowId: e.DIDIT_WORKFLOW_ID ?? "",
  diditWebhookSecret: e.DIDIT_WEBHOOK_SECRET ?? "",
  /** Keys the one-way hash used to stop one ID being used by several devs. */
  idHashSecret: e.ID_HASH_SECRET ?? e.SESSION_SECRET ?? "dev-only-id-hash",
  /** Wallets allowed to use /admin (comma separated). */
  adminWallets: (e.ADMIN_WALLETS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  /** Pinata JWT for Pump.fun metadata (IPFS). LetsBonk uses its own free uploader. */
  pinataJwt: e.PINATA_JWT ?? "",
  /** Builder API: master OpenRouter key that every dev key routes through. */
  openrouterKey: e.OPENROUTER_API_KEY ?? "",
  builderCreditUsd: Number(e.BUILDER_MONTHLY_CREDIT_USD ?? 5),
  builderRpm: Number(e.BUILDER_RPM ?? 60),
  builderMaxTokens: Number(e.BUILDER_MAX_TOKENS ?? 8192),
  builderMaxKeys: Number(e.BUILDER_MAX_KEYS ?? 5),
  /** Optional comma-separated model allowlist, e.g. "openai/gpt-5-mini,anthropic/claude-haiku-5-5". Empty = all. */
  builderModels: (e.BUILDER_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  /** Priority fee (SOL) for create transactions. */
  priorityFeeSol: Number(e.PRIORITY_FEE_SOL ?? 0.0005),
  /** Lets the mock provider run in production for a staging/demo deploy. Remove once a real provider is connected. */
  allowMockKyd: e.ALLOW_MOCK_KYD === "true",
  kydVerifyUrl: e.KYD_VERIFY_URL ?? "",
  kydWebhookSecret: e.KYD_WEBHOOK_SECRET ?? "",
  /** Fill an empty database with demo tokens so the UI isn't blank. */
  seedDemo: (e.SEED_DEMO ?? "true") === "true",
  /** Background jobs on/off (turn off when running several instances). */
  jobs: (e.RUN_JOBS ?? "true") === "true",
};

export function requireDb() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is not set");
  return env.databaseUrl;
}
