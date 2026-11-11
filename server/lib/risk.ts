// Decision engine for getting doxed.
//  1. Hard rules on Didit's result (document authenticity, liveness, face match, age, expiry).
//  2. Duplicate-ID guard: one identity document → one dev.
//  3. AI risk check: a model reviews the structured fraud signals (never images or document numbers)
//     and can escalate to human review. It can never approve what the rules rejected or sent to review.
import { createHmac } from "node:crypto";
import { env } from "../env";
import type { DiditDecision } from "./didit";

export type Outcome = "approved" | "rejected" | "review";
export type Evaluation = {
  outcome: Outcome;
  reasons: string[];
  docHash: string | null;
  identity: { legalName?: string; dateOfBirth?: string; country?: string; docType?: string };
  signals: Record<string, unknown>;
  ai: AiReview | null;
};
export type AiReview = { risk: "low" | "medium" | "high"; recommendation: "approve" | "review" | "reject"; reasons: string[] };

const MIN_LIVENESS = 70;
const MIN_FACE = 70;
const up = (s?: string) => (s ?? "").toUpperCase();

export function docHash(docNumber?: string, issuingState?: string) {
  if (!docNumber) return null;
  const norm = `${up(issuingState)}:${docNumber.replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
  return createHmac("sha256", env.idHashSecret).update(norm).digest("hex");
}

function ageFrom(dob?: string, given?: number) {
  if (typeof given === "number" && given > 0) return given;
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(+d)) return null;
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  if (now < new Date(Date.UTC(now.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))) a--;
  return a;
}

export async function evaluate(d: DiditDecision, isDuplicate: (hash: string) => Promise<boolean>): Promise<Evaluation> {
  const idv = d.id_verifications?.[0];
  const live = d.liveness_checks?.[0];
  const face = d.face_matches?.[0];
  const warnings = [...(idv?.warnings ?? []), ...(live?.warnings ?? []), ...(face?.warnings ?? [])];
  const highRisk = warnings.filter((w) => up(w.risk) === "HIGH" || up(w.log_type) === "ERROR");
  const age = ageFrom(idv?.date_of_birth, idv?.age);
  const expired = idv?.expiration_date ? new Date(idv.expiration_date) < new Date() : false;
  const hash = docHash(idv?.document_number, idv?.issuing_state);

  const signals = {
    diditStatus: d.status,
    document: { status: idv?.status, type: idv?.document_type, issuingState: idv?.issuing_state, nationality: idv?.nationality, age, expired },
    liveness: { status: live?.status, score: live?.score, method: live?.method },
    faceMatch: { status: face?.status, score: face?.score },
    warnings: warnings.map((w) => ({ feature: w.feature, risk: w.risk, text: w.short_description })),
    ip: d.ip_analyses?.[0] ?? null,
  };
  const identity = {
    legalName: idv?.full_name || [idv?.first_name, idv?.last_name].filter(Boolean).join(" ") || undefined,
    dateOfBirth: idv?.date_of_birth,
    country: idv?.issuing_state || idv?.nationality,
    docType: idv?.document_type,
  };

  const reject: string[] = [];
  const review: string[] = [];
  const st = up(d.status);
  if (st === "DECLINED") reject.push("The ID check or face scan didn't pass.");
  if (st === "IN REVIEW") review.push("Didit flagged this session for manual review.");
  if (up(idv?.status) !== "APPROVED") reject.push("The ID document couldn't be verified as genuine.");
  if (up(live?.status) !== "APPROVED" || (live?.score ?? 0) < MIN_LIVENESS) reject.push("The face scan didn't pass the liveness check.");
  if (up(face?.status) !== "APPROVED" || (face?.score ?? 0) < MIN_FACE) reject.push("Your face didn't match the photo on the ID.");
  if (age != null && age < 18) reject.push("You must be 18 or older to launch.");
  if (expired) reject.push("The ID document has expired.");
  if (!hash) review.push("No document number was read from the ID.");
  if (hash && (await isDuplicate(hash))) reject.push("This ID is already linked to another Doxed Dev account.");
  if (highRisk.length) review.push(`High-risk signals: ${highRisk.map((w) => w.short_description).filter(Boolean).join("; ")}`);

  let outcome: Outcome = reject.length ? "rejected" : review.length ? "review" : "approved";

  // AI risk check on the signals (only when the rules would otherwise approve or review).
  let ai: AiReview | null = null;
  if (outcome !== "rejected" && env.anthropicKey) {
    try {
      ai = await aiRiskCheck(signals);
      if (outcome === "approved" && (ai.risk === "high" || ai.recommendation !== "approve")) {
        outcome = "review";
        review.push(`AI risk check: ${ai.reasons.join("; ") || ai.risk + " risk"}`);
      }
    } catch (err) {
      console.error("[risk] AI check failed:", (err as Error).message);
      if (outcome === "approved") {
        outcome = "review";
        review.push("AI risk check unavailable — held for a quick manual review.");
      }
    }
  }
  return { outcome, reasons: outcome === "rejected" ? reject : review, docHash: hash, identity, signals, ai };
}

async function aiRiskCheck(signals: Record<string, unknown>): Promise<AiReview> {
  const system = `You are a fraud analyst reviewing an identity verification for a crypto token launchpad.
You receive ONLY machine signals from an ID + liveness + face-match provider (no images, no names).
Look for signs of fake or altered documents, screen/print replays, deepfakes, mismatched countries,
VPN/Tor/hosting IPs, borderline scores, or contradictory signals. Be conservative but don't invent problems.
Reply with ONLY JSON: {"risk":"low"|"medium"|"high","recommendation":"approve"|"review"|"reject","reasons":[short strings, max 3]}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.anthropicKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: env.aiModel, max_tokens: 400, system, messages: [{ role: "user", content: JSON.stringify(signals) }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  const m = (json.content.find((c) => c.type === "text")?.text ?? "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON");
  const out = JSON.parse(m[0]) as AiReview;
  if (!["low", "medium", "high"].includes(out.risk)) out.risk = "medium";
  if (!["approve", "review", "reject"].includes(out.recommendation)) out.recommendation = "review";
  out.reasons = (out.reasons ?? []).slice(0, 3).map(String);
  return out;
}
