// Boot-time self-setup + the admin "Setup" checklist. Never returns secret values — only whether
// each key is set and whether a live check against the service passed.
import { env } from "../env";
import { sql } from "../db";
import { aiProvider, resolveModel } from "./ai";
import { createWorkflow } from "./didit";
import { getSetting, setSetting } from "./settings";

const OR_BASE = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

/** Creates the ID-check workflow once and remembers it, so DIDIT_WORKFLOW_ID is optional. */
export async function bootstrapIntegrations() {
  if (env.kydProvider === "didit" && env.diditApiKey && !env.diditWorkflowId) {
    const saved = await getSetting("didit_workflow_id");
    if (saved) env.diditWorkflowId = saved;
    else {
      try {
        const w = await createWorkflow();
        const id = w.uuid ?? w.workflow_id ?? w.id;
        if (id) {
          await setSetting("didit_workflow_id", id);
          env.diditWorkflowId = id;
          console.log("[setup] verification workflow created");
        }
      } catch (err) {
        console.error("[setup] could not create verification workflow:", (err as Error).message);
      }
    }
  }
}

export type Check = {
  id: string;
  name: string;
  purpose: string;
  keys: { name: string; set: boolean; required: boolean }[];
  status: "ok" | "missing" | "error" | "partial";
  detail: string;
};

const k = (name: string, set: boolean, required = true) => ({ name, set, required });
const timeout = () => ({ signal: AbortSignal.timeout(8_000) });
async function probe(fn: () => Promise<string>): Promise<[Check["status"], string]> {
  try {
    return ["ok", await fn()];
  } catch (err) {
    return ["error", (err as Error).message.slice(0, 160)];
  }
}

export async function setupChecks(): Promise<{ publicUrl: string; webhookUrl: string; checks: Check[] }> {
  const webhookUrl = `${env.publicUrl}/api/kyd/didit/webhook`;
  const checks: Promise<Check>[] = [];
  const add = (c: Check | Promise<Check>) => checks.push(Promise.resolve(c));

  add(
    (async (): Promise<Check> => {
      const [s, d] = await probe(async () => {
        const [r] = await sql<{ n: number }[]>`select count(*)::int as n from schema_migrations`;
        return `${r.n} migrations applied`;
      });
      return { id: "db", name: "Database", purpose: "Everything", keys: [k("DATABASE_URL", !!env.databaseUrl)], status: s, detail: d };
    })(),
  );

  add(
    (async (): Promise<Check> => {
      if (!env.heliusKey) return { id: "rpc", name: "Solana data", purpose: "Fee-claim history, fast lock checks, sending transactions", keys: [k("HELIUS_API_KEY", false)], status: "missing", detail: "Using the slow public RPC — fee claims are off" };
      const [s, d] = await probe(async () => {
        const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${env.heliusKey}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }),
          ...timeout(),
        });
        const j = (await r.json()) as { result?: number; error?: { message: string } };
        if (!r.ok || j.error) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
        return `Connected · slot ${j.result}`;
      });
      return { id: "rpc", name: "Solana data", purpose: "Fee-claim history, fast lock checks, sending transactions", keys: [k("HELIUS_API_KEY", true)], status: s, detail: d };
    })(),
  );

  add(
    (async (): Promise<Check> => {
      const keys = [k("ANTHROPIC_API_KEY", !!env.anthropicKey, false), k("OPENROUTER_API_KEY", !!env.openrouterKey, false)];
      const p = aiProvider();
      if (!p) return { id: "ai", name: "AI summaries & reviews", purpose: "Token summaries, GitHub reviews, fake-ID risk check", keys, status: "missing", detail: "Set either key — the Builder key alone is enough" };
      const [s, d] = await probe(async () => `Running on ${p === "anthropic" ? "the Anthropic key" : "the Builder key"} · ${await resolveModel()}`);
      return { id: "ai", name: "AI summaries & reviews", purpose: "Token summaries, GitHub reviews, fake-ID risk check", keys, status: s, detail: d };
    })(),
  );

  add(
    (async (): Promise<Check> => {
      const keys = [k("OPENROUTER_API_KEY", !!env.openrouterKey)];
      if (!env.openrouterKey) return { id: "builder", name: "Builder API", purpose: "dxd_ keys + $" + env.builderCreditUsd + "/mo compute for doxed devs", keys, status: "missing", detail: "Builder API shows as 'not switched on yet'" };
      const [s, d] = await probe(async () => {
        const r = await fetch(`${OR_BASE}/key`, { headers: { authorization: `Bearer ${env.openrouterKey}` }, ...timeout() });
        if (!r.ok) throw new Error(r.status === 401 ? "Key rejected" : `HTTP ${r.status}`);
        const { data } = (await r.json()) as { data: { usage?: number; limit?: number | null; limit_remaining?: number | null } };
        const cap = data.limit == null ? "no spending cap set — add one" : `$${(data.limit_remaining ?? 0).toFixed(2)} of $${data.limit} cap left`;
        return `Connected · $${(data.usage ?? 0).toFixed(2)} spent · ${cap}`;
      });
      return { id: "builder", name: "Builder API", purpose: `dxd_ keys + $${env.builderCreditUsd}/mo compute for doxed devs`, keys, status: s, detail: d };
    })(),
  );

  {
    const keys = [k("DIDIT_API_KEY", !!env.diditApiKey), k("DIDIT_WEBHOOK_SECRET", !!env.diditWebhookSecret), k("DIDIT_WORKFLOW_ID", !!env.diditWorkflowId, false)];
    const status: Check["status"] = !env.diditApiKey ? "missing" : !env.diditWebhookSecret || !env.diditWorkflowId ? "partial" : "ok";
    const detail =
      status === "missing"
        ? env.allowMockKyd
          ? "Demo mode — every verification is approved instantly"
          : "Verification is switched off"
        : !env.diditWorkflowId
          ? "Workflow not created yet — check the key and restart"
          : !env.diditWebhookSecret
            ? "Add the webhook secret so results arrive instantly (polling every 3 min until then)"
            : "ID scan → face scan live";
    add({ id: "kyd", name: "ID verification", purpose: "Scan ID → face scan → fake-ID checks", keys, status, detail });
  }

  add(
    (async (): Promise<Check> => {
      const keys = [k("PINATA_JWT", !!env.pinataJwt)];
      if (!env.pinataJwt) return { id: "ipfs", name: "Pump.fun launches", purpose: "Token image + metadata storage", keys, status: "missing", detail: "Pump.fun is off — LetsBonk launches still work" };
      const [s, d] = await probe(async () => {
        const r = await fetch("https://api.pinata.cloud/data/testAuthentication", { headers: { authorization: `Bearer ${env.pinataJwt}` }, ...timeout() });
        if (!r.ok) throw new Error(r.status === 401 ? "Key rejected" : `HTTP ${r.status}`);
        return "Connected";
      });
      return { id: "ipfs", name: "Pump.fun launches", purpose: "Token image + metadata storage", keys, status: s, detail: d };
    })(),
  );

  {
    const fee = env.launchFeeSol > 0;
    const keys = [k("LAUNCH_FEE_SOL", fee, false), k("TREASURY_WALLET", !!env.treasuryWallet, false)];
    const ok = fee && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(env.treasuryWallet);
    add({
      id: "fee",
      name: "Launch fee",
      purpose: "Revenue that covers Builder compute",
      keys,
      status: ok ? "ok" : fee || env.treasuryWallet ? "partial" : "missing",
      detail: ok ? `${env.launchFeeSol} SOL per launch → ${env.treasuryWallet.slice(0, 4)}…${env.treasuryWallet.slice(-4)}` : fee || env.treasuryWallet ? "Set both the fee and a valid treasury wallet" : "Launches are free",
    });
  }

  add({
    id: "admin",
    name: "Admin access",
    purpose: "Review queue for held verifications",
    keys: [k("ADMIN_WALLETS", env.adminWallets.length > 0)],
    status: env.adminWallets.length ? "ok" : "missing",
    detail: env.adminWallets.length ? `${env.adminWallets.length} admin wallet${env.adminWallets.length > 1 ? "s" : ""}` : "Nobody can review held verifications",
  });

  add(
    (async (): Promise<Check> => {
      const keys = [k("GITHUB_TOKEN", !!env.githubToken, false), k("X_BEARER_TOKEN", !!env.xBearer, false)];
      const parts = [env.githubToken ? "GitHub: 5,000 req/h" : "GitHub: 60 req/h (no token)", env.xBearer ? "X posts: on" : "X posts: off (website only)"];
      return { id: "sources", name: "Summary sources", purpose: "Repo reviews + recent X posts in AI summaries", keys, status: env.githubToken && env.xBearer ? "ok" : "partial", detail: parts.join(" · ") };
    })(),
  );

  {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from launches where is_demo`;
    add({
      id: "demo",
      name: "Demo data",
      purpose: "Sample tokens so the site isn't empty",
      keys: [k("SEED_DEMO", env.seedDemo, false)],
      status: n ? "partial" : "ok",
      detail: n ? `${n} demo tokens listed — remove them before going public` : "No demo tokens",
    });
  }

  return { publicUrl: env.publicUrl, webhookUrl, checks: await Promise.all(checks) };
}

/** Deletes the sample tokens/devs and stops them coming back on the next boot. */
export async function clearDemo() {
  await sql.begin(async (tx) => {
    await tx`delete from launches where is_demo`;
    await tx`delete from dev_kyc_private where dev_id in (select dev_id from dev_profiles where is_demo)`;
    await tx`insert into app_settings (key, value) values ('demo_cleared', 'true') on conflict (key) do update set value = 'true', updated_at = now()`;
  });
}
