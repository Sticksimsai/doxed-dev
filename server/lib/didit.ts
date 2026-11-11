// Didit: hosted "scan ID → face scan" with document fraud checks, passive liveness and face match.
// Docs: https://docs.didit.me (sessions API, v3 decision object, webhooks with X-Signature-V2).
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

const BASE = process.env.DIDIT_BASE_URL ?? "https://verification.didit.me"; // override only for local tests

async function didit<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-api-key": env.diditApiKey, "content-type": "application/json", ...init?.headers },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`[kyd] provider ${res.status}: ${body.slice(0, 300)}`);
    throw new Error("The verification service is unavailable right now — please try again in a minute.");
  }
  return JSON.parse(body) as T;
}

export type DiditSession = { session_id: string; url: string; status: string };

export function createSession(devId: string, wallet: string) {
  return didit<DiditSession>("/v3/session/", {
    method: "POST",
    body: JSON.stringify({
      workflow_id: env.diditWorkflowId,
      vendor_data: devId, // stable per dev → Didit's duplicate detection + one open session per dev
      callback: `${env.publicUrl}/launch?verified=1`,
      metadata: { wallet },
    }),
  });
}

type Warning = { feature?: string; risk?: string; short_description?: string; log_type?: string };
export type DiditDecision = {
  session_id: string;
  status: string;
  vendor_data?: string;
  id_verifications?: {
    status: string;
    document_type?: string;
    document_number?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    date_of_birth?: string;
    age?: number;
    expiration_date?: string;
    issuing_state?: string;
    nationality?: string;
    warnings?: Warning[];
  }[] | null;
  liveness_checks?: { status: string; method?: string; score?: number; warnings?: Warning[] }[] | null;
  face_matches?: { status: string; score?: number; warnings?: Warning[] }[] | null;
  ip_analyses?: Record<string, unknown>[] | null;
};

export const getDecision = (sessionId: string) => didit<DiditDecision>(`/v3/session/${sessionId}/decision/`);

/** Canonical JSON for X-Signature-V2: recursively sorted keys, compact, unicode unescaped. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

const hmac = (s: string | Buffer) => createHmac("sha256", env.diditWebhookSecret).update(s).digest("hex");
const same = (a: string, b?: string) => !!b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Verifies a Didit webhook (timestamp within 5 min; V2 canonical signature, else raw-body signature). */
export function verifyDiditWebhook(raw: string, headers: (name: string) => string | undefined): boolean {
  if (!env.diditWebhookSecret) return false;
  const ts = Number(headers("x-timestamp"));
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  const v2 = hmac(canonical(parsed));
  if (same(v2, headers("x-signature-v2")) || same(v2, headers("x-signature-v2-previous"))) return true;
  const v1 = hmac(raw);
  return same(v1, headers("x-signature")) || same(v1, headers("x-signature-previous"));
}

/** One-time helper: creates the KYC workflow (ID + passive liveness + face match + IP). */
export function createWorkflow() {
  return didit<{ uuid?: string; workflow_id?: string; id?: string }>("/v3/workflows/", {
    method: "POST",
    body: JSON.stringify({
      workflow_label: "Doxed Dev KYC",
      features: [
        { feature: "ID_VERIFICATION" },
        { feature: "LIVENESS", config: { face_liveness_method: "PASSIVE" } },
        { feature: "FACE_MATCH" },
        { feature: "IP_ANALYSIS" },
      ],
    }),
  });
}
