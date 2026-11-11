// Doxed Dev API + static frontend, one Node process.
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { secureHeaders } from "hono/secure-headers";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { env } from "./env";
import { migrate, sql } from "./db";
import { createNonce, endSession, requireWallet, sessionWallet, signInMessage, startSession, verifySignIn } from "./lib/auth";
import { applyResult, startVerification, verifyWebhookSignature } from "./lib/kyd";
import { getDev, getToken, listDevsByIds, listTokens, tokensByDev } from "./lib/views";
import { tokenSupply } from "./lib/solana";
import { confirmLock, startJobs } from "./jobs";
import { seedDemo } from "./seed";
import { LAUNCHPADS } from "../src/lib/mock";

type Vars = { Variables: { wallet: string } };
const app = new Hono<Vars>();
const api = new Hono<Vars>();

app.use("*", secureHeaders({ contentSecurityPolicy: undefined, crossOriginEmbedderPolicy: false }));

// --- tiny per-IP rate limiter for write endpoints
const hits = new Map<string, { n: number; reset: number }>();
const limit = (max: number, windowMs: number) => async (c: any, next: any) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const k = `${c.req.path}:${ip}`;
  const now = Date.now();
  const h = hits.get(k);
  if (!h || h.reset < now) hits.set(k, { n: 1, reset: now + windowMs });
  else if (++h.n > max) return c.json({ error: "Too many requests, slow down." }, 429);
  await next();
};

const wallet58 = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Not a Solana address");

// ------------------------------------------------------------------ public reads
api.get("/health", async (c) => {
  await sql`select 1`;
  return c.json({ ok: true, jobs: env.jobs, ai: !!env.anthropicKey, helius: !!env.heliusKey, kyd: env.kydProvider, mockKyd: env.kydProvider === "mock" });
});
api.get("/launchpads", (c) => c.json(LAUNCHPADS));
api.get("/tokens", async (c) => {
  c.header("cache-control", "public, max-age=10");
  const tokens = await listTokens();
  const devs = await listDevsByIds([...new Set(tokens.map((t) => t.devId))]);
  return c.json({ tokens, devs });
});
api.get("/tokens/:mint", async (c) => {
  const token = await getToken(c.req.param("mint")!);
  if (!token) return c.json({ error: "Token not found" }, 404);
  return c.json({ token, dev: await getDev(token.devId) });
});
api.get("/devs/:id", async (c) => {
  const dev = await getDev(c.req.param("id")!);
  if (!dev) return c.json({ error: "Dev not found" }, 404);
  return c.json({ dev, tokens: await tokensByDev(dev.id) });
});

// ------------------------------------------------------------------ wallet sign-in
api.post("/auth/nonce", limit(20, 60_000), async (c) => {
  const body = z.object({ wallet: wallet58 }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid wallet" }, 400);
  const nonce = await createNonce(body.data.wallet);
  return c.json({ nonce, message: signInMessage(body.data.wallet, nonce, c.req.header("host") ?? "doxed.dev") });
});
api.post("/auth/verify", limit(20, 60_000), async (c) => {
  const body = z.object({ wallet: wallet58, nonce: z.string(), signature: z.string() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid request" }, 400);
  const ok = await verifySignIn(body.data.wallet, body.data.nonce, body.data.signature, c.req.header("host") ?? "doxed.dev");
  if (!ok) return c.json({ error: "Signature check failed — try again." }, 401);
  await startSession(c, body.data.wallet);
  return c.json({ wallet: body.data.wallet });
});
api.post("/auth/logout", (c) => {
  endSession(c);
  return c.json({ ok: true });
});
api.get("/me", async (c) => {
  const wallet = await sessionWallet(c);
  if (!wallet) return c.json({ wallet: null, dev: null });
  const [dev] = await sql`
    select p.dev_id, p.alias, p.disclosure, k.status from dev_profiles p join dev_kyc_private k using (dev_id) where p.wallet = ${wallet}`;
  return c.json({ wallet, dev: dev ? { id: dev.dev_id, alias: dev.alias, disclosure: dev.disclosure, status: dev.status } : null });
});

// ------------------------------------------------------------------ getting doxed
api.post("/kyd/start", limit(10, 60_000), requireWallet, async (c) => {
  const body = z
    .object({
      alias: z.string().trim().min(3).max(24).regex(/^[\w.-]+$/, "Letters, numbers, dot, dash, underscore"),
      disclosure: z.enum(["private", "pseudonymous", "public"]),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: body.error.issues[0].message }, 400);
  try {
    return c.json(await startVerification(c.get("wallet"), body.data.alias, body.data.disclosure));
  } catch (err) {
    const msg = (err as Error).message;
    return c.json({ error: /unique|duplicate/i.test(msg) ? "That alias is taken." : msg }, 400);
  }
});

api.post("/kyd/webhook", async (c) => {
  const raw = await c.req.text();
  if (!verifyWebhookSignature(raw, c.req.header("x-doxed-signature"))) return c.json({ error: "Bad signature" }, 401);
  const body = z
    .object({
      applicantId: z.string(),
      status: z.enum(["approved", "rejected"]),
      checks: z.object({ identity: z.boolean().optional(), liveness: z.boolean().optional(), screening: z.boolean().optional() }),
      legalName: z.string().optional(),
      dateOfBirth: z.string().optional(),
      country: z.string().optional(),
    })
    .safeParse(JSON.parse(raw));
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  await applyResult(body.data);
  return c.json({ ok: true });
});

api.patch("/me/profile", requireWallet, async (c) => {
  const body = z
    .object({
      disclosure: z.enum(["private", "pseudonymous", "public"]).optional(),
      bio: z.string().max(280).optional(),
      revealName: z.boolean().optional(),
      revealRegion: z.boolean().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid request" }, 400);
  const b = body.data;
  try {
    await sql`
      update dev_profiles set
        disclosure = coalesce(${b.disclosure ?? null}::disclosure_level, disclosure),
        bio = coalesce(${b.bio ?? null}, bio),
        reveal_name = coalesce(${b.revealName ?? null}, reveal_name),
        reveal_region = coalesce(${b.revealRegion ?? null}, reveal_region)
      where wallet = ${c.get("wallet")}`;
  } catch {
    return c.json({ error: "You can reveal more, but not less, than before." }, 400);
  }
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ launches
const LaunchBody = z.object({
  mint: wallet58,
  launchpad: z.enum(["pumpfun", "raydium", "bonk", "meteora"]),
  name: z.string().trim().min(2).max(32),
  symbol: z.string().trim().regex(/^[A-Za-z0-9]{2,10}$/),
  description: z.string().max(280).optional(),
  imageUrl: z.string().url().optional(),
  x: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  github: z.string().optional(),
  devBuySol: z.number().min(0).max(1000).optional(),
  lockMonths: z.number().int().min(12).max(60).default(12),
  poolAddress: wallet58.optional(),
});

/** Registers a token the dev just created on a launchpad. It stays hidden until the lock is verified. */
api.post("/launches", limit(10, 60_000), requireWallet, async (c) => {
  const parsed = LaunchBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const b = parsed.data;
  const [dev] = await sql`select p.dev_id from dev_profiles p join dev_kyc_private k using (dev_id)
                          where p.wallet = ${c.get("wallet")} and k.status = 'approved' and not p.flagged`;
  if (!dev) return c.json({ error: "Get doxed before launching." }, 403);
  if ((await tokenSupply(b.mint)) == null) return c.json({ error: "That mint doesn't exist on Solana mainnet yet." }, 400);
  try {
    await sql`
      insert into launches (mint, dev_id, launchpad, name, symbol, description, image_url, x_url, website_url, github_repo,
                            dev_buy_sol, lock_months, pool_address, stage)
      values (${b.mint}, ${dev.dev_id}, ${b.launchpad}, ${b.name}, ${b.symbol.toUpperCase()}, ${b.description ?? null}, ${b.imageUrl ?? null},
              ${b.x || null}, ${b.website || null}, ${b.github || null}, ${b.devBuySol ?? null}, ${b.lockMonths}, ${b.poolAddress ?? null}, 'pending_lock')`;
  } catch {
    return c.json({ error: "This token is already registered." }, 409);
  }
  return c.json({ mint: b.mint, stage: "pending_lock", next: `Lock 100% of your ${b.symbol} on Streamflow for ${b.lockMonths}+ months, then verify.` });
});

api.post("/launches/:mint/verify-lock", limit(10, 60_000), requireWallet, async (c) => {
  const mint = c.req.param("mint")!;
  const [l] = await sql`select l.lock_months, p.wallet from launches l join dev_profiles p using (dev_id) where l.mint = ${mint}`;
  if (!l) return c.json({ error: "Launch not found" }, 404);
  if (l.wallet !== c.get("wallet")) return c.json({ error: "Only the launching dev can verify this lock." }, 403);
  const res = await confirmLock(mint, l.wallet, l.lock_months);
  return res.ok ? c.json({ ok: true, unlocksAt: res.unlocksAt, amount: res.amount }) : c.json({ ok: false, error: res.reason }, 400);
});

api.get("/me/launches", requireWallet, async (c) => {
  const rows = await sql`select l.mint, l.name, l.symbol, l.stage, l.created_at from launches l join dev_profiles p using (dev_id)
                         where p.wallet = ${c.get("wallet")} order by l.created_at desc`;
  return c.json(rows);
});

api.onError((err, c) => {
  console.error("[api]", err);
  return c.json({ error: "Something went wrong on our side." }, 500);
});

app.route("/api", api);

// ------------------------------------------------------------------ frontend (built by Vite into /dist)
const dist = join(import.meta.dirname, "..", "dist");
if (existsSync(dist)) {
  app.use("/assets/*", serveStatic({ root: dist, onFound: (_p, c) => c.header("cache-control", "public, max-age=31536000, immutable") }));
  app.use("*", serveStatic({ root: dist }));
  const indexHtml = readFileSync(join(dist, "index.html"), "utf8");
  app.get("*", (c) => c.html(indexHtml)); // SPA fallback for /token/..., /dev/..., etc.
}

// ------------------------------------------------------------------ boot
await migrate();
if (env.seedDemo) await seedDemo();
startJobs();
serve({ fetch: app.fetch, port: env.port }, (i) => console.log(`[doxed] listening on :${i.port}`));
