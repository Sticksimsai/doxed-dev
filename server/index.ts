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
import { adminDecide, kydStatus, startVerification, syncFromDidit } from "./lib/kyd";
import { verifyDiditWebhook } from "./lib/didit";
import { chatCompletions, createKey, keyInfo, listKeys, models, revokeKey, usageSummary } from "./lib/builder";
import { cors } from "hono/cors";
import { IN_APP_LAUNCHPADS, buildCreateTx, buildLockTx, sendSigned, signatureStatus, uploadMetadata } from "./lib/launch";
import { getDev, getToken, listDevsByIds, listTokens, tokensByDev } from "./lib/views";
import { tokenSupply } from "./lib/solana";
import { confirmLock, startJobs } from "./jobs";
import { seedDemo } from "./seed";
import { LAUNCHPADS } from "../src/lib/mock";
import { bootstrapIntegrations, clearDemo, setupChecks } from "./lib/setup";
import { aiReady } from "./lib/ai";

type Vars = { Variables: { wallet: string; devId: string } };
const app = new Hono<Vars>();
const api = new Hono<Vars>();

app.use("*", secureHeaders({ contentSecurityPolicy: undefined, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: "same-origin-allow-popups" }));
// The ID + face scan runs in an iframe from verify.didit.me and needs camera access.
app.use("*", async (c, next) => {
  await next();
  const o = env.kydFrameOrigin;
  c.header("Permissions-Policy", `camera=(self "${o}"), microphone=(self "${o}"), fullscreen=(self "${o}")`);
});

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
  return c.json({ ok: true, jobs: env.jobs, ai: aiReady(), builder: !!env.openrouterKey, pump: !!env.pinataJwt, helius: !!env.heliusKey, kyd: env.kydProvider, mockKyd: env.kydProvider === "mock" });
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
  return c.json({
    wallet,
    isAdmin: env.adminWallets.includes(wallet),
    dev: dev ? { id: dev.dev_id, alias: dev.alias, disclosure: dev.disclosure, status: dev.status } : null,
  });
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

api.get("/kyd/status", requireWallet, async (c) => c.json(await kydStatus(c.get("wallet"))));

/** Didit → us. Signature-checked, deduplicated, then the decision is re-fetched from Didit (source of truth). */
api.post("/kyd/didit/webhook", async (c) => {
  const raw = await c.req.text();
  if (!verifyDiditWebhook(raw, (h) => c.req.header(h))) return c.json({ error: "Bad signature" }, 401);
  const body = JSON.parse(raw) as { event_id?: string; session_id?: string; vendor_data?: string };
  if (body.event_id) {
    const fresh = await sql`insert into kyd_webhook_events (event_id) values (${body.event_id}) on conflict do nothing returning event_id`;
    if (!fresh.length) return c.json({ ok: true, duplicate: true });
  }
  const [row] = await sql`select dev_id from dev_kyc_private where session_id = ${body.session_id ?? ""}
                          or dev_id::text = ${body.vendor_data ?? ""} limit 1`;
  if (row) syncFromDidit(row.dev_id).catch((e) => console.error("[kyd] webhook sync", e.message));
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ admin review queue
const requireAdmin = async (c: any, next: any) => {
  if (!env.adminWallets.includes(c.get("wallet"))) return c.json({ error: "Admins only." }, 403);
  await next();
};
api.get("/admin/setup", requireWallet, requireAdmin, async (c) => c.json(await setupChecks()));
api.post("/admin/demo/clear", requireWallet, requireAdmin, async (c) => {
  await clearDemo();
  return c.json({ ok: true });
});
api.get("/admin/reviews", requireWallet, requireAdmin, async (c) => {
  const rows = await sql`
    select p.dev_id, p.alias, p.wallet, k.status, k.doc_type, k.country, k.signals, k.ai_review, k.session_id, k.updated_at
    from dev_kyc_private k join dev_profiles p using (dev_id)
    where k.status in ('review', 'rejected', 'in_progress') order by (k.status = 'review') desc, k.updated_at desc limit 100`;
  return c.json(rows);
});
api.post("/admin/reviews/:devId", requireWallet, requireAdmin, async (c) => {
  const body = z.object({ approve: z.boolean() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid request" }, 400);
  try {
    await adminDecide(c.req.param("devId")!, body.data.approve, c.get("wallet"));
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
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
const requireDoxed = async (c: any, next: any) => {
  const [d] = await sql`select p.dev_id from dev_profiles p join dev_kyc_private k using (dev_id)
                        where p.wallet = ${c.get("wallet")} and k.status = 'approved' and not p.flagged`;
  if (!d) return c.json({ error: "Get doxed before launching." }, 403);
  c.set("devId", d.dev_id);
  await next();
};

api.get("/launch/config", (c) =>
  c.json({ inApp: IN_APP_LAUNCHPADS, pumpReady: !!env.pinataJwt, minDevBuySol: 0.01, minLockMonths: 12, launchFeeSol: env.treasuryWallet ? env.launchFeeSol : 0 }),
);

/** Step 1: image + details → IPFS metadata. */
api.post("/launch/metadata", limit(10, 60_000), requireWallet, requireDoxed, async (c) => {
  const form = await c.req.parseBody();
  const image = form.image;
  if (!(image instanceof File)) return c.json({ error: "Add a token image." }, 400);
  if (image.size > 2_000_000) return c.json({ error: "Image must be under 2 MB." }, 400);
  if (!/^image\/(png|jpe?g|gif|webp)$/.test(image.type)) return c.json({ error: "Use a PNG, JPG, GIF or WebP image." }, 400);
  const f = z
    .object({
      launchpad: z.enum(IN_APP_LAUNCHPADS),
      name: z.string().trim().min(2).max(32),
      symbol: z.string().trim().regex(/^[A-Za-z0-9]{2,10}$/),
      description: z.string().max(280).optional(),
      x: z.string().max(200).optional(),
      website: z.string().max(200).optional(),
    })
    .safeParse(form);
  if (!f.success) return c.json({ error: f.error.issues[0].message }, 400);
  try {
    const out = await uploadMetadata({ ...f.data, symbol: f.data.symbol.toUpperCase(), image, imageName: image.name || "token.png" });
    return c.json(out);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

/** Step 2: build the create + dev-buy transaction (pre-signed by the new mint), and record a draft launch. */
api.post("/launch/create-tx", limit(10, 60_000), requireWallet, requireDoxed, async (c) => {
  const b = z
    .object({
      launchpad: z.enum(IN_APP_LAUNCHPADS, { message: "In-app launches support Pump.fun and LetsBonk for now." }),
      name: z.string().trim().min(2, "Name is too short.").max(32),
      symbol: z.string().trim().regex(/^[A-Za-z0-9]{2,10}$/, "Ticker must be 2–10 letters or numbers."),
      description: z.string().max(280).optional(),
      uri: z.string().url(),
      image: z.string().url().optional(),
      x: z.string().max(200).optional(),
      website: z.string().max(200).optional(),
      github: z.string().max(200).optional(),
      devBuySol: z.number({ message: "Enter a dev buy in SOL." }).min(0.01, "Dev buy must be at least 0.01 SOL.").max(100, "Dev buy can be at most 100 SOL."),
      lockMonths: z.number().int().min(12, "Locks are at least 12 months.").max(60, "Locks can be at most 60 months."),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!b.success) return c.json({ error: b.error.issues[0].message }, 400);
  const d = b.data;
  try {
    const { mint, tx } = await buildCreateTx({ wallet: c.get("wallet"), launchpad: d.launchpad, name: d.name, symbol: d.symbol.toUpperCase(), uri: d.uri, devBuySol: d.devBuySol });
    await sql`
      insert into launches (mint, dev_id, launchpad, name, symbol, description, image_url, metadata_uri, x_url, website_url, github_repo,
                            dev_buy_sol, lock_months, stage)
      values (${mint}, ${c.get("devId")}, ${d.launchpad}, ${d.name}, ${d.symbol.toUpperCase()}, ${d.description ?? null}, ${d.image ?? null}, ${d.uri},
              ${d.x || null}, ${d.website || null}, ${d.github || null}, ${d.devBuySol}, ${d.lockMonths}, 'draft')`;
    return c.json({ mint, tx });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

const ownLaunch = async (c: any) => {
  const [l] = await sql`select l.*, p.wallet from launches l join dev_profiles p using (dev_id) where l.mint = ${c.req.param("mint")}`;
  if (!l || l.wallet !== c.get("wallet")) return null;
  return l;
};

api.get("/tx/:sig", async (c) => c.json(await signatureStatus(c.req.param("sig")!)));

/** Fallback broadcaster for wallets without signAndSendTransaction. Only relays already-signed txs. */
api.post("/tx/send", limit(20, 60_000), requireWallet, async (c) => {
  const { tx } = (await c.req.json().catch(() => ({}))) as { tx?: string };
  if (!tx || tx.length > 4000) return c.json({ error: "Invalid transaction" }, 400);
  try {
    return c.json({ signature: await sendSigned(tx) });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

/** Step 3: dev confirms the create landed → launch moves to pending_lock. */
api.post("/launch/:mint/created", requireWallet, async (c) => {
  const l = await ownLaunch(c);
  if (!l) return c.json({ error: "Launch not found" }, 404);
  const { signature } = (await c.req.json().catch(() => ({}))) as { signature?: string };
  if (!signature) return c.json({ error: "Missing signature" }, 400);
  const st = await signatureStatus(signature);
  if (st.state !== "confirmed") return c.json({ error: st.state === "failed" ? `Launch transaction failed: ${st.error}` : "Not confirmed yet" }, 409);
  await sql`update launches set stage = 'pending_lock', create_signature = ${signature} where mint = ${l.mint} and stage in ('draft','pending_lock')`;
  return c.json({ ok: true });
});

/** Step 4: build the lock for 100% of the dev wallet's tokens. */
api.post("/launch/:mint/lock-tx", limit(10, 60_000), requireWallet, async (c) => {
  const l = await ownLaunch(c);
  if (!l) return c.json({ error: "Launch not found" }, 404);
  try {
    const out = await buildLockTx({ wallet: l.wallet, mint: l.mint, months: l.lock_months, symbol: l.symbol });
    await sql`update launches set lock_contract = ${out.lockId} where mint = ${l.mint}`;
    return c.json(out);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

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
  return c.json({ mint: b.mint, stage: "pending_lock", next: `Lock 100% of your ${b.symbol} in an on-chain lock for ${b.lockMonths}+ months, then verify.` });
});

api.post("/launches/:mint/verify-lock", limit(10, 60_000), requireWallet, async (c) => {
  const mint = c.req.param("mint")!;
  const [l] = await sql`select l.lock_months, p.wallet from launches l join dev_profiles p using (dev_id) where l.mint = ${mint}`;
  if (!l) return c.json({ error: "Launch not found" }, 404);
  if (l.wallet !== c.get("wallet")) return c.json({ error: "Only the launching dev can verify this lock." }, 403);
  const { signature } = (await c.req.json().catch(() => ({}))) as { signature?: string };
  if (signature) await sql`update launches set lock_signature = ${signature} where mint = ${mint}`;
  const res = await confirmLock(mint, l.wallet, l.lock_months);
  return res.ok ? c.json({ ok: true, unlocksAt: res.unlocksAt, amount: res.amount }) : c.json({ ok: false, error: res.reason }, 400);
});

api.get("/me/launches", requireWallet, async (c) => {
  const rows = await sql`select l.mint, l.name, l.symbol, l.stage, l.created_at from launches l join dev_profiles p using (dev_id)
                         where p.wallet = ${c.get("wallet")} order by l.created_at desc`;
  return c.json(rows);
});

// ------------------------------------------------------------------ Builder API
// OpenAI-compatible gateway: base URL https://<host>/api/v1, key "dxd_…".
api.use("/v1/*", cors({ origin: "*", allowHeaders: ["authorization", "content-type"], allowMethods: ["GET", "POST", "OPTIONS"] }));
api.post("/v1/chat/completions", chatCompletions);
api.get("/v1/models", models);
api.get("/v1/key", keyInfo);

// Key management (signed-in, doxed devs)
api.get("/builder/config", (c) =>
  c.json({ enabled: !!env.openrouterKey, creditUsd: env.builderCreditUsd, rpm: env.builderRpm, maxKeys: env.builderMaxKeys, models: env.builderModels }),
);
api.get("/builder/keys", requireWallet, requireDoxed, async (c) => c.json(await listKeys(c.get("devId"))));
api.post("/builder/keys", limit(10, 60_000), requireWallet, requireDoxed, async (c) => {
  const b = z.object({ name: z.string().trim().min(1, "Give the key a name.").max(40) }).safeParse(await c.req.json().catch(() => ({})));
  if (!b.success) return c.json({ error: b.error.issues[0].message }, 400);
  try {
    return c.json(await createKey(c.get("devId"), b.data.name));
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});
api.delete("/builder/keys/:id", requireWallet, requireDoxed, async (c) => {
  const ok = await revokeKey(c.get("devId"), c.req.param("id")!).catch(() => false);
  return ok ? c.json({ ok: true }) : c.json({ error: "Key not found" }, 404);
});
api.get("/builder/usage", requireWallet, requireDoxed, async (c) => c.json(await usageSummary(c.get("devId"))));

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
await bootstrapIntegrations();
if (env.seedDemo) await seedDemo();
startJobs();
serve({ fetch: app.fetch, port: env.port }, (i) => console.log(`[doxed] listening on :${i.port}`));
