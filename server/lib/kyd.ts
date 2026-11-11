// Identity verification ("getting doxed"). Provider-agnostic:
//  - "mock":    instant approval for local dev / demos. NEVER enable in production.
//  - "webhook": you redirect devs to your KYC provider (KYD_VERIFY_URL) and the provider —
//               or a small adapter in front of it — POSTs the result to /api/kyd/webhook,
//               signed with HMAC-SHA256(KYD_WEBHOOK_SECRET, rawBody) in the x-doxed-signature header.
// Webhook body: { applicantId, status: "approved"|"rejected", checks: {identity, liveness, screening},
//                 legalName?, dateOfBirth?, country? }
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { sql } from "../db";
import { env } from "../env";

export function verifyWebhookSignature(rawBody: string, signature: string | undefined) {
  if (!env.kydWebhookSecret || !signature) return false;
  const expected = createHmac("sha256", env.kydWebhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Starts (or resumes) verification for a wallet. Returns where to send the dev next. */
export async function startVerification(wallet: string, alias: string, disclosure: "private" | "pseudonymous" | "public") {
  const existing = await sql<{ dev_id: string; status: string; provider_applicant_id: string }[]>`
    select k.dev_id, k.status, k.provider_applicant_id from dev_profiles p join dev_kyc_private k using (dev_id) where p.wallet = ${wallet}`;
  let devId = existing[0]?.dev_id;
  let applicantId = existing[0]?.provider_applicant_id;
  if (existing[0]?.status === "approved") return { status: "approved" as const, devId };

  if (!devId) {
    applicantId = randomUUID();
    await sql.begin(async (tx) => {
      const [k] = await tx<{ dev_id: string }[]>`
        insert into dev_kyc_private (provider, provider_applicant_id) values (${env.kydProvider}, ${applicantId}) returning dev_id`;
      devId = k.dev_id;
      await tx`insert into dev_profiles (dev_id, alias, wallet, disclosure) values (${devId}, ${alias}, ${wallet}, ${disclosure})`;
    });
  }

  if (env.kydProvider === "mock") {
    if (env.isProd && !env.allowMockKyd) throw new Error("Identity verification isn't connected yet.");
    await applyResult({ applicantId: applicantId!, status: "approved", checks: { identity: true, liveness: true, screening: true } });
    return { status: "approved" as const, devId };
  }
  const url = new URL(env.kydVerifyUrl);
  url.searchParams.set("applicant", applicantId!);
  return { status: "pending" as const, devId, redirectUrl: url.toString() };
}

export async function applyResult(r: {
  applicantId: string;
  status: "approved" | "rejected";
  checks: { identity?: boolean; liveness?: boolean; screening?: boolean };
  legalName?: string;
  dateOfBirth?: string;
  country?: string;
}) {
  const approved = r.status === "approved" && r.checks.identity && r.checks.liveness && r.checks.screening;
  await sql`
    update dev_kyc_private set
      status = ${approved ? "approved" : "rejected"},
      checks = ${sql.json(r.checks)},
      legal_name = coalesce(${r.legalName ?? null}, legal_name),
      date_of_birth = coalesce(${r.dateOfBirth ?? null}::date, date_of_birth),
      country = coalesce(${r.country ?? null}, country),
      verified_at = ${approved ? sql`now()` : null}
    where provider_applicant_id = ${r.applicantId}`;
}
