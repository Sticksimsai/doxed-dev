// Getting doxed: profile + verification lifecycle.
//   pending → in_progress (Didit session open) → approved | rejected | review (admin decides)
// Raw identity fields only ever land in dev_kyc_private; the public view never selects them.
import { randomUUID } from "node:crypto";
import { sql } from "../db";
import { env } from "../env";
import { createSession, getDecision, type DiditDecision } from "./didit";
import { evaluate } from "./risk";

type Disclosure = "private" | "pseudonymous" | "public";
export type KydStatus = { status: "none" | "pending" | "in_progress" | "approved" | "rejected" | "review"; url?: string; reasons?: string[] };

async function rowFor(wallet: string) {
  const [r] = await sql`
    select k.dev_id, k.status, k.session_id, k.session_url, k.signals, k.updated_at
    from dev_profiles p join dev_kyc_private k using (dev_id) where p.wallet = ${wallet}`;
  return r as { dev_id: string; status: KydStatus["status"]; session_id: string | null; session_url: string | null; signals: any; updated_at: Date } | undefined;
}

export async function startVerification(wallet: string, alias: string, disclosure: Disclosure): Promise<KydStatus> {
  let row = await rowFor(wallet);
  if (row?.status === "approved") return { status: "approved" };
  if (row?.status === "review") return { status: "review" };

  if (!row) {
    await sql.begin(async (tx) => {
      const [k] = await tx<{ dev_id: string }[]>`
        insert into dev_kyc_private (provider, provider_applicant_id) values (${env.kydProvider}, ${randomUUID()}) returning dev_id`;
      await tx`insert into dev_profiles (dev_id, alias, wallet, disclosure) values (${k.dev_id}, ${alias}, ${wallet}, ${disclosure})`;
    });
    row = await rowFor(wallet);
  } else {
    // allow fixing alias/disclosure before approval
    await sql`update dev_profiles set alias = ${alias}, disclosure = ${disclosure} where dev_id = ${row.dev_id}`.catch(() => {
      throw new Error("That alias is taken.");
    });
  }
  const devId = row!.dev_id;

  if (env.kydProvider === "mock") {
    if (env.isProd && !env.allowMockKyd) throw new Error("Identity verification isn't connected yet.");
    await sql`update dev_kyc_private set status = 'approved', checks = ${sql.json({ identity: true, liveness: true, screening: true })},
              verified_at = now(), decided_by = 'mock', decided_at = now(), updated_at = now() where dev_id = ${devId}`;
    return { status: "approved" };
  }
  // If the boot-time workflow setup failed (e.g. provider hiccup), try again now.
  if (env.kydProvider === "didit" && env.diditApiKey && !env.diditWorkflowId) await (await import("./setup")).bootstrapIntegrations();
  if (env.kydProvider !== "didit" || !env.diditApiKey || !env.diditWorkflowId) throw new Error("Identity verification isn't configured.");

  // Reuse an open session (Didit also enforces one open session per dev), or open a fresh one after a rejection.
  if (row!.status === "in_progress" && row!.session_url) return { status: "in_progress", url: row!.session_url };
  const s = await createSession(devId, wallet);
  await sql`update dev_kyc_private set status = 'in_progress', provider = 'didit', session_id = ${s.session_id},
            session_url = ${s.url}, updated_at = now() where dev_id = ${devId}`;
  return { status: "in_progress", url: s.url };
}

const FINAL = new Set(["APPROVED", "DECLINED", "IN REVIEW", "ABANDONED", "EXPIRED"]);

/** Pulls the latest decision from Didit and applies it. Safe to call repeatedly. */
export async function syncFromDidit(devId: string): Promise<void> {
  const [r] = await sql`select session_id, status from dev_kyc_private where dev_id = ${devId}`;
  if (!r?.session_id || r.status !== "in_progress") return;
  const d = await getDecision(r.session_id);
  const st = (d.status ?? "").toUpperCase();
  if (!FINAL.has(st)) {
    await sql`update dev_kyc_private set updated_at = now() where dev_id = ${devId}`;
    return;
  }
  if (st === "ABANDONED" || st === "EXPIRED") {
    await sql`update dev_kyc_private set status = 'pending', session_id = null, session_url = null, updated_at = now() where dev_id = ${devId}`;
    return;
  }
  await applyDecision(devId, d);
}

async function applyDecision(devId: string, d: DiditDecision) {
  const ev = await evaluate(d, async (hash) => {
    const rows = await sql`select 1 from dev_kyc_private where doc_hash = ${hash} and status = 'approved' and dev_id <> ${devId}`;
    return rows.length > 0;
  });
  const checks = {
    identity: (d.id_verifications?.[0]?.status ?? "").toUpperCase() === "APPROVED",
    liveness: (d.liveness_checks?.[0]?.status ?? "").toUpperCase() === "APPROVED",
    screening: ev.outcome === "approved",
  };
  await sql`
    update dev_kyc_private set
      status = ${ev.outcome},
      checks = ${sql.json(checks)},
      legal_name = ${ev.identity.legalName ?? null},
      date_of_birth = ${ev.identity.dateOfBirth ?? null}::date,
      country = ${ev.identity.country ?? null},
      doc_type = ${ev.identity.docType ?? null},
      doc_hash = ${ev.docHash},
      signals = ${sql.json({ ...ev.signals, reasons: ev.reasons } as never)},
      ai_review = ${ev.ai ? sql.json(ev.ai as never) : null},
      verified_at = ${ev.outcome === "approved" ? sql`now()` : null},
      decided_by = ${ev.outcome === "review" ? null : ev.ai ? "ai+auto" : "auto"},
      decided_at = ${ev.outcome === "review" ? null : sql`now()`},
      updated_at = now()
    where dev_id = ${devId}`;
  console.log(`[kyd] ${devId} → ${ev.outcome}`, ev.reasons.join(" | "));
}

export async function kydStatus(wallet: string): Promise<KydStatus> {
  let row = await rowFor(wallet);
  if (!row) return { status: "none" };
  // Webhooks are the main path; polling here is the fallback (throttled to every 8s).
  if (row.status === "in_progress" && env.kydProvider === "didit" && Date.now() - +row.updated_at > 8000) {
    await syncFromDidit(row.dev_id).catch((e) => console.error("[kyd] sync", e.message));
    row = (await rowFor(wallet))!;
  }
  return {
    status: row.status,
    url: row.status === "in_progress" ? (row.session_url ?? undefined) : undefined,
    reasons: row.status === "rejected" ? (row.signals?.reasons ?? []) : undefined,
  };
}

/** Admin: approve or reject a held verification. */
export async function adminDecide(devId: string, approve: boolean, admin: string) {
  const [r] = await sql`select doc_hash, signals from dev_kyc_private where dev_id = ${devId} and status = 'review'`;
  if (!r) throw new Error("Nothing to review for that dev.");
  await sql`
    update dev_kyc_private set status = ${approve ? "approved" : "rejected"},
      checks = checks || ${sql.json({ screening: approve })},
      verified_at = ${approve ? sql`now()` : null}, decided_by = ${admin}, decided_at = now(), updated_at = now()
    where dev_id = ${devId}`;
}
