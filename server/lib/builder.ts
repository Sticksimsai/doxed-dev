// Builder API — every doxed dev gets their own keys into the platform's master OpenRouter key.
//   Dev → https://<host>/api/v1/chat/completions (Bearer dxd_…) → OpenRouter (master key)
// Keys are stored only as SHA-256 hashes. Every call is metered from OpenRouter's own usage.cost,
// and checked against the dev's monthly credit, a per-key cap and a per-key rate limit.
import { createHash, randomBytes } from "node:crypto";
import bs58 from "bs58";
import type { Context } from "hono";
import { sql } from "../db";
import { env } from "../env";

const OR = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"; // override only for local tests
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// ------------------------------------------------------------------ key management
export async function createKey(devId: string, name: string) {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from builder_keys where dev_id = ${devId} and revoked_at is null`;
  if (n >= env.builderMaxKeys) throw new Error(`You can have up to ${env.builderMaxKeys} active keys. Revoke one first.`);
  const raw = `dxd_${bs58.encode(randomBytes(24))}`;
  const [row] = await sql`
    insert into builder_keys (dev_id, name, prefix, key_hash) values (${devId}, ${name}, ${raw.slice(0, 12)}, ${sha(raw)})
    returning id, name, prefix, created_at`;
  return { ...row, key: raw }; // the only time the full key is ever returned
}

export async function listKeys(devId: string) {
  return sql`
    select k.id, k.name, k.prefix, k.created_at, k.last_used_at, k.monthly_limit_usd,
      coalesce((select sum(u.cost_usd) from builder_usage u where u.key_id = k.id and u.at >= date_trunc('month', now())), 0)::float as month_usd,
      coalesce((select count(*) from builder_usage u where u.key_id = k.id and u.at >= date_trunc('month', now())), 0)::int as month_requests
    from builder_keys k where k.dev_id = ${devId} and k.revoked_at is null order by k.created_at desc`;
}

export async function revokeKey(devId: string, keyId: string) {
  const r = await sql`update builder_keys set revoked_at = now() where id = ${keyId} and dev_id = ${devId} and revoked_at is null returning id`;
  authCache.clear();
  return r.length > 0;
}

export async function usageSummary(devId: string) {
  const [[tot], byModel, daily, credit] = await Promise.all([
    sql`select coalesce(sum(cost_usd),0)::float as usd, count(*)::int as requests,
               coalesce(sum(prompt_tokens),0)::int as prompt, coalesce(sum(completion_tokens),0)::int as completion
        from builder_usage where dev_id = ${devId} and at >= date_trunc('month', now())`,
    sql`select model, count(*)::int as requests, coalesce(sum(cost_usd),0)::float as usd,
               coalesce(sum(prompt_tokens + completion_tokens),0)::int as tokens
        from builder_usage where dev_id = ${devId} and at >= date_trunc('month', now())
        group by model order by usd desc limit 10`,
    sql`select date_trunc('day', at)::date as day, count(*)::int as requests, coalesce(sum(cost_usd),0)::float as usd
        from builder_usage where dev_id = ${devId} and at > now() - interval '30 days' group by 1 order by 1`,
    creditFor(devId),
  ]);
  return { creditUsd: credit, spentUsd: tot.usd, requests: tot.requests, tokens: { prompt: tot.prompt, completion: tot.completion }, byModel, daily };
}

async function creditFor(devId: string) {
  const [r] = await sql`select builder_credit_usd from dev_profiles where dev_id = ${devId}`;
  return r?.builder_credit_usd != null ? Number(r.builder_credit_usd) : env.builderCreditUsd;
}

// ------------------------------------------------------------------ auth + limits
type KeyAuth = { keyId: string; devId: string; keyLimit: number | null; credit: number; ok: boolean; reason?: string };
const authCache = new Map<string, { at: number; v: KeyAuth | null }>();
const spend = new Map<string, { at: number; devUsd: number; keyUsd: Map<string, number> }>();
const hits = new Map<string, number[]>();

async function authKey(raw: string): Promise<KeyAuth | null> {
  const h = sha(raw);
  const c = authCache.get(h);
  if (c && Date.now() - c.at < 30_000) return c.v;
  const [r] = await sql`
    select k.id, k.dev_id, k.monthly_limit_usd, p.flagged, p.builder_credit_usd, s.status
    from builder_keys k join dev_profiles p using (dev_id) join dev_kyc_private s using (dev_id)
    where k.key_hash = ${h} and k.revoked_at is null`;
  const v: KeyAuth | null = r
    ? {
        keyId: r.id,
        devId: r.dev_id,
        keyLimit: r.monthly_limit_usd != null ? Number(r.monthly_limit_usd) : null,
        credit: r.builder_credit_usd != null ? Number(r.builder_credit_usd) : env.builderCreditUsd,
        ok: r.status === "approved" && !r.flagged,
        reason: r.flagged ? "This dev account is flagged." : r.status !== "approved" ? "Get doxed to use the Builder API." : undefined,
      }
    : null;
  authCache.set(h, { at: Date.now(), v });
  return v;
}

async function spentNow(devId: string, keyId: string) {
  const c = spend.get(devId);
  if (c && Date.now() - c.at < 20_000) return { dev: c.devUsd, key: c.keyUsd.get(keyId) ?? 0 };
  const rows = await sql<{ key_id: string; usd: number }[]>`
    select key_id, coalesce(sum(cost_usd),0)::float as usd from builder_usage
    where dev_id = ${devId} and at >= date_trunc('month', now()) group by key_id`;
  const keyUsd = new Map(rows.map((r) => [r.key_id, r.usd]));
  const devUsd = rows.reduce((s, r) => s + r.usd, 0);
  spend.set(devId, { at: Date.now(), devUsd, keyUsd });
  return { dev: devUsd, key: keyUsd.get(keyId) ?? 0 };
}

function addSpend(devId: string, keyId: string, usd: number) {
  const c = spend.get(devId);
  if (!c) return;
  c.devUsd += usd;
  c.keyUsd.set(keyId, (c.keyUsd.get(keyId) ?? 0) + usd);
}

function rateLimited(keyId: string) {
  const now = Date.now();
  const arr = (hits.get(keyId) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= env.builderRpm) return true;
  arr.push(now);
  hits.set(keyId, arr);
  return false;
}

// OpenAI-style error envelope so SDKs surface the message nicely.
const oaiError = (c: Context, status: number, message: string, code: string) =>
  c.json({ error: { message, type: code, code } }, status as 400);

async function gate(c: Context): Promise<KeyAuth | Response> {
  if (!env.openrouterKey) return oaiError(c, 503, "The Builder API isn't switched on yet.", "not_configured");
  const raw = (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!raw.startsWith("dxd_")) return oaiError(c, 401, "Missing or invalid API key. Use: Authorization: Bearer dxd_…", "invalid_api_key");
  const a = await authKey(raw);
  if (!a) return oaiError(c, 401, "Invalid or revoked API key.", "invalid_api_key");
  if (!a.ok) return oaiError(c, 403, a.reason ?? "Key disabled.", "forbidden");
  if (rateLimited(a.keyId)) return oaiError(c, 429, `Rate limit: ${env.builderRpm} requests per minute per key.`, "rate_limited");
  const s = await spentNow(a.devId, a.keyId);
  if (s.dev >= a.credit) return oaiError(c, 402, `Monthly credit of $${a.credit.toFixed(2)} used up. It resets on the 1st.`, "insufficient_quota");
  if (a.keyLimit != null && s.key >= a.keyLimit) return oaiError(c, 402, `This key's monthly cap of $${a.keyLimit.toFixed(2)} is reached.`, "insufficient_quota");
  return a;
}

// ------------------------------------------------------------------ recording
type Usage = { prompt_tokens?: number; completion_tokens?: number; cost?: number };

async function record(a: KeyAuth, r: { model?: string; usage?: Usage; status: number; started: number; stream: boolean; genId?: string }) {
  let cost = Number(r.usage?.cost ?? 0);
  // Stream cut short (client disconnected) → ask OpenRouter what the generation actually cost.
  if (!r.usage && r.genId) cost = await generationCost(r.genId);
  addSpend(a.devId, a.keyId, cost);
  await sql`
    insert into builder_usage (key_id, dev_id, model, prompt_tokens, completion_tokens, cost_usd, status, latency_ms, stream, generation_id)
    values (${a.keyId}, ${a.devId}, ${r.model ?? null}, ${r.usage?.prompt_tokens ?? null}, ${r.usage?.completion_tokens ?? null}, ${cost},
            ${r.status}, ${Date.now() - r.started}, ${r.stream}, ${r.genId ?? null})`;
  await sql`update builder_keys set last_used_at = now() where id = ${a.keyId}`;
}

async function generationCost(id: string) {
  for (let i = 0; i < 4; i++) {
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    const r = await fetch(`${OR}/generation?id=${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${env.openrouterKey}` } }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as { data?: { total_cost?: number } };
      if (j.data?.total_cost != null) return Number(j.data.total_cost);
    }
  }
  return 0;
}

// ------------------------------------------------------------------ white-label
// Responses are rewritten so builders only ever see Doxed: our own ids, no upstream provider
// fields, no upstream names in errors or stream keep-alives.
const scrub = (t: string) => t.replace(/open\s?router(\.ai)?/gi, "Doxed");
const mapId = (id: unknown) => (typeof id === "string" ? `dxd-${id.replace(/^gen-/, "")}` : id);
function clean(j: any) {
  if (!j || typeof j !== "object") return j;
  if (j.id) j.id = mapId(j.id);
  delete j.provider;
  if (j.usage) {
    delete j.usage.cost_details;
    delete j.usage.is_byok;
  }
  if (j.error) {
    j.error = { message: scrub(String(j.error.message ?? "Upstream error")), type: j.error.type ?? "upstream_error", code: j.error.code ?? j.error.type ?? "upstream_error" };
  }
  for (const ch of j.choices ?? []) delete ch.native_finish_reason;
  return j;
}

// ------------------------------------------------------------------ proxy
const upstreamHeaders = () => ({
  authorization: `Bearer ${env.openrouterKey}`,
  "content-type": "application/json",
  "HTTP-Referer": env.publicUrl,
  "X-Title": "Doxed Dev",
});

export async function chatCompletions(c: Context) {
  const g = await gate(c);
  if (g instanceof Response) return g;
  const a = g;

  let body: Record<string, any>;
  try {
    body = await c.req.json();
  } catch {
    return oaiError(c, 400, "Body must be JSON.", "invalid_request_error");
  }
  if (typeof body.model !== "string" || !body.model) return oaiError(c, 400, "`model` is required, e.g. \"openai/gpt-5-mini\".", "invalid_request_error");
  if (env.builderModels.length && !env.builderModels.includes(body.model))
    return oaiError(c, 400, `Model not available. Allowed: ${env.builderModels.join(", ")}`, "model_not_allowed");

  // Guard rails: cap output length, attribute usage to the dev on OpenRouter's side.
  for (const k of ["max_tokens", "max_completion_tokens"])
    if (typeof body[k] === "number") body[k] = Math.min(body[k], env.builderMaxTokens);
  if (body.max_tokens == null && body.max_completion_tokens == null) body.max_tokens = env.builderMaxTokens;
  body.user = a.devId;
  delete body.usage;

  const started = Date.now();
  const stream = body.stream === true;
  const up = await fetch(`${OR}/chat/completions`, { method: "POST", headers: upstreamHeaders(), body: JSON.stringify(body) }).catch(() => null);
  if (!up) return oaiError(c, 502, "Upstream model provider unreachable. Try again.", "upstream_error");

  if (!stream || !up.body || !up.ok) {
    const text = await up.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {}
    record(a, { model: json?.model ?? body.model, usage: json?.usage, status: up.status, started, stream: false, genId: json?.id }).catch((e) =>
      console.error("[builder] record", e.message),
    );
    const out = json ? JSON.stringify(clean(json)) : JSON.stringify({ error: { message: scrub(text.slice(0, 300)) || "Upstream error", type: "upstream_error", code: "upstream_error" } });
    return new Response(out, { status: up.status, headers: { "content-type": "application/json" } });
  }

  // Streaming: pass bytes straight through, while watching the SSE for the id and the final usage chunk.
  const reader = up.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let usage: Usage | undefined;
  let genId: string | undefined;
  let model: string | undefined;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    record(a, { model: model ?? body.model, usage, status: up.status, started, stream: true, genId }).catch((e) => console.error("[builder] record", e.message));
  };
  const enc = new TextEncoder();
  const rewrite = (raw: string) => {
    const line = raw.trimEnd();
    if (line.startsWith(":")) return ": keep-alive"; // upstream keep-alive comments carry its name
    if (!line.startsWith("data:")) return line;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") return "data: [DONE]";
    try {
      const j = JSON.parse(payload);
      genId ??= j.id;
      model ??= j.model;
      if (j.usage) usage = { ...j.usage };
      return `data: ${JSON.stringify(clean(j))}`;
    } catch {
      return `data: ${scrub(payload)}`;
    }
  };
  const out = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      const { value, done: end } = await reader.read();
      if (end) {
        if (buf) ctrl.enqueue(enc.encode(rewrite(buf) + "\n"));
        finish();
        ctrl.close();
        return;
      }
      buf += dec.decode(value, { stream: true });
      let i: number;
      let chunk = "";
      while ((i = buf.indexOf("\n")) >= 0) {
        chunk += rewrite(buf.slice(0, i)) + "\n";
        buf = buf.slice(i + 1);
      }
      if (chunk) ctrl.enqueue(enc.encode(chunk));
    },
    async cancel() {
      await reader.cancel().catch(() => {});
      finish();
    },
  });
  return new Response(out, {
    status: up.status,
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive" },
  });
}

let modelsCache: { at: number; data: unknown } | null = null;
export async function models(c: Context) {
  if (!modelsCache || Date.now() - modelsCache.at > 10 * 60_000) {
    const r = await fetch(`${OR}/models`, { headers: upstreamHeaders() }).catch(() => null);
    if (!r?.ok) return oaiError(c, 502, "Couldn't load the model list.", "upstream_error");
    const j = (await r.json()) as { data: { id: string; name?: string; created?: number; context_length?: number; pricing?: { prompt?: string; completion?: string }; architecture?: { input_modalities?: string[]; output_modalities?: string[] }; supported_parameters?: string[] }[] };
    const list = (env.builderModels.length ? j.data.filter((m) => env.builderModels.includes(m.id)) : j.data).map((m) => ({
      id: m.id,
      object: "model",
      created: m.created ?? 0,
      owned_by: m.id.split("/")[0],
      name: m.name,
      context_length: m.context_length,
      pricing: m.pricing ? { prompt: m.pricing.prompt, completion: m.pricing.completion } : undefined,
      input_modalities: m.architecture?.input_modalities,
      output_modalities: m.architecture?.output_modalities,
      supported_parameters: m.supported_parameters,
    }));
    modelsCache = { at: Date.now(), data: { object: "list", data: list } };
  }
  return c.json(modelsCache.data);
}

/** GET /v1/key — lets a dev's code check remaining credit. */
export async function keyInfo(c: Context) {
  const raw = (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const a = raw.startsWith("dxd_") ? await authKey(raw) : null;
  if (!a) return oaiError(c, 401, "Invalid or revoked API key.", "invalid_api_key");
  const s = await spentNow(a.devId, a.keyId);
  return c.json({ data: { credit_usd: a.credit, spent_usd: Math.round(s.dev * 1e6) / 1e6, remaining_usd: Math.max(0, a.credit - s.dev), key_limit_usd: a.keyLimit, rpm: env.builderRpm } });
}
