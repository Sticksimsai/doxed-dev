import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { http, USE_MOCK } from "@/lib/api";
import { ago, cn, short } from "@/lib/format";
import { useMe } from "@/lib/session";
import { CheckCircle2, CircleAlert, XCircle } from "@/components/icons";

type Review = {
  dev_id: string;
  alias: string;
  wallet: string;
  status: "review" | "rejected" | "in_progress";
  doc_type: string | null;
  country: string | null;
  signals: {
    reasons?: string[];
    document?: { status?: string; type?: string; issuingState?: string; age?: number; expired?: boolean };
    liveness?: { status?: string; score?: number };
    faceMatch?: { status?: string; score?: number };
    warnings?: { risk?: string; text?: string }[];
  };
  ai_review: { risk: string; recommendation: string; reasons: string[] } | null;
  session_id: string | null;
  updated_at: string;
};

export function AdminPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => http<Review[]>("/admin/reviews"),
    enabled: !!me?.isAdmin && !USE_MOCK,
    refetchInterval: 15_000,
  });

  if (USE_MOCK) return <Empty text="The review queue needs the live backend." />;
  if (!me?.wallet) return <Empty text="Connect an admin wallet to see the review queue." />;
  if (!me.isAdmin) return <Empty text="This wallet isn't on the admin list (ADMIN_WALLETS)." />;

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await http(`/admin/reviews/${id}`, { method: "POST", json: { approve } });
      await qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="font-display text-3xl font-semibold">Verification review</h1>
      <p className="font-prose text-sm text-muted-foreground">
        Held and rejected verifications. Images stay with Didit — open the session in the Didit console to see them.
      </p>
      {isLoading && <div className="text-sm text-subtle">Loading…</div>}
      {error && <div className="text-sm text-danger">{(error as Error).message}</div>}
      {data?.length === 0 && <Empty text="Nothing waiting. 🎉" />}
      {data?.map((r) => (
        <div key={r.dev_id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium">{r.alias}</span>
              <span className="ml-2 font-mono text-xs text-subtle">{short(r.wallet, 4, 4)}</span>
              <span className={cn("chip ml-2 uppercase", r.status === "review" ? "border-foreground/50 text-foreground" : "border-border-strong text-subtle")}>
                {r.status.replace("_", " ")}
              </span>
            </div>
            <span className="text-xs text-subtle">{ago(r.updated_at)} ago · {r.session_id ? short(r.session_id, 6, 4) : "no session"}</span>
          </div>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <Signal label="Document" ok={r.signals.document?.status?.toUpperCase() === "APPROVED"} text={`${r.signals.document?.type ?? r.doc_type ?? "—"} · ${r.signals.document?.issuingState ?? r.country ?? "—"} · age ${r.signals.document?.age ?? "?"}`} />
            <Signal label="Liveness" ok={r.signals.liveness?.status?.toUpperCase() === "APPROVED"} text={`score ${r.signals.liveness?.score ?? "—"}`} />
            <Signal label="Face match" ok={r.signals.faceMatch?.status?.toUpperCase() === "APPROVED"} text={`score ${r.signals.faceMatch?.score ?? "—"}`} />
          </div>
          {!!r.signals.reasons?.length && (
            <ul className="font-prose mt-3 list-inside list-disc text-sm text-muted-foreground">
              {r.signals.reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          {r.ai_review && (
            <div className="mt-3 rounded-md border border-dashed border-border-strong p-3 text-sm">
              <span className="font-pixel text-[10px] uppercase text-subtle">AI risk check</span>
              <div>
                risk <b>{r.ai_review.risk}</b> · recommends <b>{r.ai_review.recommendation}</b>
              </div>
              <div className="font-prose text-muted-foreground">{r.ai_review.reasons.join(" · ")}</div>
            </div>
          )}
          {r.status === "review" && (
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" disabled={busy === r.dev_id} onClick={() => decide(r.dev_id, true)}>
                Approve
              </button>
              <button className="btn-ghost" disabled={busy === r.dev_id} onClick={() => decide(r.dev_id, false)}>
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Signal({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  const I = ok ? CheckCircle2 : text.includes("—") ? CircleAlert : XCircle;
  return (
    <div className="flex gap-2 rounded-md border border-border p-2">
      <I className={cn("mt-0.5 h-4 w-4 shrink-0", ok ? "text-success" : "text-danger")} />
      <div>
        <div className="font-pixel text-[10px] uppercase text-subtle">{label}</div>
        <div>{text}</div>
      </div>
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <div className="card p-8 text-center text-sm text-muted-foreground">{text}</div>;
