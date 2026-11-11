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
  /** Identity provider. "mock" auto-approves — never use it in production. */
  kydProvider: (e.KYD_PROVIDER ?? "mock") as "mock" | "webhook",
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
