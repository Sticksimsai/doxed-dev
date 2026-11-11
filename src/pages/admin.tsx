import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { http, USE_MOCK } from "@/lib/api";
import { ago, cn, short } from "@/lib/format";
import { signAndSend, useMe, waitForConfirmation } from "@/lib/session";
import { CheckCircle2, CircleAlert, Copy, RefreshCw, XCircle } from "@/components/icons";

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
      <SetupPanel />
      <MeteoraPanel />
      <h1 className="pt-6 font-display text-3xl font-semibold">Verification review</h1>
      <p className="font-prose text-sm text-muted-foreground">
        Held and rejected verifications. Images stay with the verification provider — open the session in the verification console to see them.
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

type Check = {
  id: string;
  name: string;
  purpose: string;
  keys: { name: string; set: boolean; required: boolean }[];
  status: "ok" | "missing" | "error" | "partial";
  detail: string;
};

function SetupPanel() {
  const qc = useQueryClient();
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-setup"],
    queryFn: () => http<{ publicUrl: string; webhookUrl: string; checks: Check[] }>("/admin/setup"),
  });
  const [clearing, setClearing] = useState(false);
  const ok = data?.checks.filter((c) => c.status === "ok").length ?? 0;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Setup</h1>
          <p className="font-prose text-sm text-muted-foreground">
            Live check of every connection. Keys are set in the hosting dashboard → Environment, then the server restarts on its own.
          </p>
        </div>
        <button className="btn-ghost text-sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} /> {isFetching ? "Checking…" : `Re-check · ${ok}/${data?.checks.length ?? "–"} ready`}
        </button>
      </div>
      {data && (
        <div className="card flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="eyebrow">Verification webhook URL</span>
          <code className="min-w-0 flex-1 break-all font-mono text-xs">{data.webhookUrl}</code>
          <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => navigator.clipboard?.writeText(data.webhookUrl)}>
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {data?.checks.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{c.name}</div>
                <div className="font-prose text-xs text-subtle">{c.purpose}</div>
              </div>
              <StatusChip s={c.status} />
            </div>
            <div className="font-prose mt-2 text-sm text-muted-foreground">{c.detail}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.keys.map((k) => (
                <span key={k.name} className={cn("chip font-mono text-[11px]", k.set ? "border-success/40 text-success" : k.required ? "border-danger/40 text-danger" : "border-dashed border-border-strong text-subtle")}>
                  {k.set ? "✓" : "○"} {k.name}
                </span>
              ))}
            </div>
            {c.id === "demo" && c.status === "partial" && (
              <button
                className="btn-ghost mt-3 text-xs"
                disabled={clearing}
                onClick={async () => {
                  if (!confirm("Remove all demo tokens and devs? This can't be undone.")) return;
                  setClearing(true);
                  try {
                    await http("/admin/demo/clear", { method: "POST" });
                    await qc.invalidateQueries();
                  } finally {
                    setClearing(false);
                  }
                }}
              >
                {clearing ? "Removing…" : "Remove demo data"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

type Tier = { taxBps: number; config: string | null };

function MeteoraPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-meteora"],
    queryFn: () => http<{ tiers: Tier[]; preset: { totalSupply: number; initialMarketCapSol: number; graduationMarketCapSol: number; creatorFeeShare: number }; treasury: string | null }>("/admin/meteora"),
  });
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function create(taxBps: number) {
    setBusy(taxBps);
    setMsg(null);
    try {
      const { tx, config } = await http<{ tx: string; config: string }>("/admin/meteora/config-tx", { method: "POST", json: { taxBps } });
      const sig = await signAndSend(tx);
      await waitForConfirmation(sig);
      for (let i = 0; ; i++) {
        try {
          await http("/admin/meteora/config", { method: "POST", json: { taxBps, config, signature: sig } });
          break;
        } catch (e) {
          if (i >= 4) throw e;
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
      setMsg(`${taxBps / 100}% tier is live.`);
      await qc.invalidateQueries({ queryKey: ["admin-meteora"] });
      await qc.invalidateQueries({ queryKey: ["launch-config"] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!data) return null;
  return (
    <section className="space-y-3 pt-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Meteora presets</h2>
        <p className="font-prose text-sm text-muted-foreground">
          Every Meteora launch shares one preset — {data.preset.totalSupply.toLocaleString()} supply, {data.preset.initialMarketCapSol} → {data.preset.graduationMarketCapSol} SOL
          market cap curve, LP locked forever, dev gets {data.preset.creatorFeeShare}% of the tax and the treasury the rest. Each tax option needs its config key created once
          (your wallet pays ~0.01 SOL rent).
        </p>
      </div>
      {!data.treasury && <p className="text-sm text-danger">Set TREASURY_WALLET first — it receives the platform share of the tax.</p>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.tiers.map((t) => (
          <div key={t.taxBps} className="card flex items-center gap-3 p-4">
            <div className="font-mono text-2xl">{t.taxBps / 100}%</div>
            <div className="min-w-0 flex-1">
              {t.config ? (
                <>
                  <div className="text-xs text-success">Live</div>
                  <a href={`https://solscan.io/account/${t.config}`} target="_blank" rel="noreferrer" className="block truncate font-mono text-xs text-subtle hover:text-foreground">
                    {short(t.config, 6, 6)}
                  </a>
                </>
              ) : (
                <div className="text-xs text-subtle">No config yet</div>
              )}
            </div>
            {!t.config && (
              <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy !== null || !data.treasury} onClick={() => create(t.taxBps)}>
                {busy === t.taxBps ? "Creating…" : "Create"}
              </button>
            )}
          </div>
        ))}
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <p className="text-xs text-subtle">Change the offered options with METEORA_TAX_OPTIONS (e.g. "1,2,3,5"). Already have config keys? Set METEORA_CONFIGS="3:Key,5:Key".</p>
    </section>
  );
}

function StatusChip({ s }: { s: Check["status"] }) {
  const map = { ok: ["Connected", "border-success/50 text-success"], partial: ["Partial", "border-foreground/40 text-foreground"], missing: ["Not set", "border-border-strong text-subtle"], error: ["Error", "border-danger/50 text-danger"] } as const;
  return <span className={cn("chip shrink-0 font-pixel text-[9px] uppercase", map[s][1])}>{map[s][0]}</span>;
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
