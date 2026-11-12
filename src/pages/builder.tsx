import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Code2, Copy, Loader2, Terminal, Zap } from "@/components/icons";
import { Cursor, Scramble } from "@/components/code-fx";
import { http, USE_MOCK } from "@/lib/api";
import { APP_NAME, SITE_URL } from "@/lib/brand";
import { ago, cn, int } from "@/lib/format";
import { useMe, useSignIn } from "@/lib/session";

type Cfg = { enabled: boolean; creditUsd: number; rpm: number; maxKeys: number; models: string[] };
type Key = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; month_usd: number; month_requests: number };
type Usage = {
  creditUsd: number;
  spentUsd: number;
  requests: number;
  tokens: { prompt: number; completion: number };
  byModel: { model: string; requests: number; usd: number; tokens: number }[];
  daily: { day: string; requests: number; usd: number }[];
};

// ---- preview-mode data
const now = Date.now();
let mockKeys: Key[] = [
  { id: "k1", name: "trading bot", prefix: "dxd_7hQm2xKp", created_at: new Date(now - 6 * 864e5).toISOString(), last_used_at: new Date(now - 4e5).toISOString(), month_usd: 1.284, month_requests: 812 },
];
const mockUsage: Usage = {
  creditUsd: 100,
  spentUsd: 1.284,
  requests: 812,
  tokens: { prompt: 410_220, completion: 96_410 },
  byModel: [
    { model: "openai/gpt-5-mini", requests: 640, usd: 0.71, tokens: 380_000 },
    { model: "anthropic/claude-sonnet-4.5", requests: 150, usd: 0.48, tokens: 110_000 },
    { model: "google/gemini-2.5-flash", requests: 22, usd: 0.094, tokens: 16_630 },
  ],
  daily: Array.from({ length: 30 }, (_, i) => ({ day: new Date(now - (29 - i) * 864e5).toISOString(), requests: Math.round(10 + 40 * Math.abs(Math.sin(i / 3))), usd: 0 })),
};

const usd = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;

export function BuilderPage() {
  const { data: me } = useMe();
  const signIn = useSignIn();
  const qc = useQueryClient();
  const doxxed = me?.dev?.status === "approved";
  const base = `${!USE_MOCK && typeof location !== "undefined" && location.protocol.startsWith("http") ? location.origin : SITE_URL}/api/v1`;

  const { data: cfg } = useQuery({
    queryKey: ["builder-config"],
    queryFn: () => (USE_MOCK ? Promise.resolve<Cfg>({ enabled: true, creditUsd: 100, rpm: 60, maxKeys: 5, models: [] }) : http<Cfg>("/builder/config")),
  });
  const { data: keys } = useQuery({
    queryKey: ["builder-keys"],
    queryFn: () => (USE_MOCK ? Promise.resolve(mockKeys) : http<Key[]>("/builder/keys")),
    enabled: doxxed,
  });
  const { data: usage } = useQuery({
    queryKey: ["builder-usage"],
    queryFn: () => (USE_MOCK ? Promise.resolve(mockUsage) : http<Usage>("/builder/usage")),
    enabled: doxxed,
    refetchInterval: 30_000,
  });

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    setErr(null);
    setCreating(true);
    try {
      if (USE_MOCK) {
        const k = "dxd_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        mockKeys = [{ id: k, name: name || "new key", prefix: k.slice(0, 12), created_at: new Date().toISOString(), last_used_at: null, month_usd: 0, month_requests: 0 }, ...mockKeys];
        setFresh(k);
      } else {
        const r = await http<{ key: string }>("/builder/keys", { method: "POST", json: { name: name || "my key" } });
        setFresh(r.key);
      }
      setName("");
      qc.invalidateQueries({ queryKey: ["builder-keys"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  };
  const revoke = async (id: string) => {
    if (!confirmRevoke(id)) return;
    if (USE_MOCK) mockKeys = mockKeys.filter((k) => k.id !== id);
    else await http(`/builder/keys/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["builder-keys"] });
  };

  const credit = usage?.creditUsd ?? cfg?.creditUsd ?? 0;
  const spent = usage?.spentUsd ?? 0;
  const pct = credit ? Math.min(100, (spent / credit) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="relative overflow-hidden rounded-xl border border-border bg-card px-5 py-8 md:px-10 md:py-10">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(80%_90%_at_90%_0%,black,transparent)]" />
        <div className="relative grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-[4px] border border-border-strong px-2 py-1 font-pixel text-[10px] uppercase text-muted-foreground">
              <Code2 className="h-3 w-3" /> Builder API · doxxed devs only
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] md:text-5xl">
              <Scramble text="Build with any model." />
              <span className="block text-muted-foreground">
                <Scramble text="One key. On us." delay={300} />
                <Cursor className="text-foreground" />
              </span>
            </h1>
            <p className="font-prose mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Every doxxed dev gets API keys to hundreds of AI models — GPT, Claude, Gemini, Llama and more — through one
              OpenAI-compatible endpoint, with <span className="text-foreground">${(cfg?.creditUsd ?? 100).toFixed(0)} of free compute every month</span>.
              Ship your bot, agent or app without setting up billing anywhere.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/builder/docs" className="btn-primary">
                Read the docs
              </Link>
              <a href="#keys" className="btn-ghost">
                Get a key
              </a>
            </div>
          </div>
          <div className="glass rounded-xl p-4 font-mono text-[12.5px] leading-relaxed">
            <div className="text-subtle">$ curl {base.replace(/^https?:\/\//, "")}/chat/completions \</div>
            <div className="pl-4 text-muted-foreground">-H "Authorization: Bearer dxd_…" \</div>
            <div className="pl-4 text-muted-foreground">-d '{"{"}"model":"openai/gpt-5-mini", …{"}"}'</div>
            <div className="mt-2 text-foreground">→ 200 OK · usage metered to your key</div>
          </div>
        </div>
      </section>

      {cfg && !cfg.enabled && (
        <div className="card p-4 text-sm text-muted-foreground">The Builder API is being switched on — check back soon.</div>
      )}

      {!me?.wallet ? (
        <Gate text="Connect your wallet to manage your API keys.">
          <button className="btn-primary" onClick={() => signIn.mutate()} disabled={signIn.isPending}>
            {signIn.isPending ? "Waiting for wallet…" : "Connect wallet"}
          </button>
        </Gate>
      ) : !doxxed ? (
        <Gate text={`API keys are for doxxed devs. Scan your ID once (about 2 minutes) and you're in — it also lets you launch on ${APP_NAME}.`}>
          <Link to="/launch" className="btn-primary">
            Get doxxed
          </Link>
        </Gate>
      ) : (
        <>
          {/* credit */}
          <section className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="card p-4">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">This month</span>
                <span className="font-mono text-xs text-subtle">resets on the 1st</span>
              </div>
              <div className="mt-2 font-mono text-2xl font-medium">
                {usd(spent)} <span className="text-base text-subtle">/ ${credit.toFixed(2)}</span>
              </div>
              <div className="mt-3 flex gap-[3px]">
                {Array.from({ length: 30 }, (_, i) => (
                  <span key={i} className={cn("h-2.5 flex-1", i < Math.round((pct / 100) * 30) ? (pct > 90 ? "bg-danger" : "bg-foreground") : "bg-white/10")} />
                ))}
              </div>
            </div>
            <Stat label="Requests" value={int(usage?.requests ?? 0)} />
            <Stat label="Tokens" value={int((usage?.tokens.prompt ?? 0) + (usage?.tokens.completion ?? 0))} />
          </section>

          {/* keys */}
          <section id="keys" className="card scroll-mt-32 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-medium">API keys</h2>
                <p className="text-xs text-subtle">
                  Up to {cfg?.maxKeys ?? 5} keys · {cfg?.rpm ?? 60} requests/min each · keep them server-side
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <input className="input h-9 sm:w-48" placeholder="Key name, e.g. my bot" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
                <button className="btn-primary h-9" onClick={create} disabled={creating}>
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} New key
                </button>
              </div>
            </div>
            {err && <p className="mt-3 text-sm text-danger">{err}</p>}

            {fresh && (
              <div className="mt-4 rounded-lg border border-foreground/50 bg-foreground/5 p-4">
                <div className="text-sm font-medium">Copy your key now — it won't be shown again.</div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border border-border-strong bg-black/50 px-3 py-2 font-mono text-[13px]">{fresh}</code>
                  <CopyBtn value={fresh} />
                </div>
                <button className="mt-2 text-xs text-subtle underline decoration-dotted underline-offset-4" onClick={() => setFresh(null)}>
                  I've saved it
                </button>
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="font-pixel text-[10px] uppercase text-subtle">
                  <tr className="text-left">
                    <th className="py-2 pr-3 font-normal">Name</th>
                    <th className="py-2 pr-3 font-normal">Key</th>
                    <th className="hidden py-2 pr-3 text-right font-normal sm:table-cell">Requests</th>
                    <th className="py-2 pr-3 text-right font-normal">Spend</th>
                    <th className="hidden py-2 pr-3 text-right font-normal md:table-cell">Last used</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {keys?.map((k) => (
                    <tr key={k.id} className="border-t border-border">
                      <td className="py-2.5 pr-3">{k.name}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{k.prefix}…</td>
                      <td className="hidden py-2.5 pr-3 text-right tabular sm:table-cell">{int(k.month_requests)}</td>
                      <td className="py-2.5 pr-3 text-right tabular">{usd(k.month_usd)}</td>
                      <td className="hidden py-2.5 pr-3 text-right text-subtle md:table-cell">{k.last_used_at ? `${ago(k.last_used_at)} ago` : "never"}</td>
                      <td className="py-2.5 text-right">
                        <button className="text-xs text-subtle hover:text-danger" onClick={() => revoke(k.id)}>
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                  {keys?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-subtle">
                        No keys yet — create one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* usage */}
          {!!usage?.byModel.length && (
            <section className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
              <div className="card p-5">
                <h2 className="font-display text-lg font-medium">Last 30 days</h2>
                <div className="mt-4 flex h-24 items-end gap-[3px]">
                  {usage.daily.map((d) => {
                    const max = Math.max(...usage.daily.map((x) => x.requests), 1);
                    return <span key={d.day} title={`${d.requests} requests`} className="flex-1 bg-foreground/80" style={{ height: `${Math.max(4, (d.requests / max) * 100)}%` }} />;
                  })}
                </div>
              </div>
              <div className="card p-5">
                <h2 className="font-display text-lg font-medium">By model</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {usage.byModel.map((m) => (
                    <li key={m.model} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{m.model}</span>
                      <span className="text-xs text-subtle tabular">{int(m.requests)} req</span>
                      <span className="w-16 text-right tabular">{usd(m.usd)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}

      <QuickStart base={base} />
    </div>
  );
}

function confirmRevoke(_id: string) {
  try {
    return window.confirm("Revoke this key? Apps using it stop working immediately.");
  } catch {
    return true;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-mono text-2xl font-medium">{value}</div>
    </div>
  );
}

function Gate({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-prose text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn-ghost !px-3"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

function QuickStart({ base }: { base: string }) {
  const [tab, setTab] = useState<"js" | "py" | "curl">("js");
  const code = {
    js: `import OpenAI from "openai";

const ai = new OpenAI({
  apiKey: process.env.DOXXED_API_KEY,   // dxd_…
  baseURL: "${base}",
});

const res = await ai.chat.completions.create({
  model: "openai/gpt-5-mini",          // any model id from /models
  messages: [{ role: "user", content: "gm" }],
});
console.log(res.choices[0].message.content);`,
    py: `from openai import OpenAI
import os

ai = OpenAI(
    api_key=os.environ["DOXXED_API_KEY"],  # dxd_…
    base_url="${base}",
)

res = ai.chat.completions.create(
    model="google/gemini-2.5-flash",
    messages=[{"role": "user", "content": "gm"}],
)
print(res.choices[0].message.content)`,
    curl: `curl ${base}/chat/completions \\
  -H "Authorization: Bearer $DOXXED_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openai/gpt-5-mini","messages":[{"role":"user","content":"gm"}],"stream":true}'

# models:            GET ${base}/models
# remaining credit:  GET ${base}/key`,
  };
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5" />
          <span className="font-display text-base font-medium">Quick start</span>
        </div>
        <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
          {(["js", "py", "curl"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded px-3 py-1", tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {t === "js" ? "JavaScript" : t === "py" ? "Python" : "cURL"}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <pre className="overflow-x-auto bg-black/40 p-4 font-mono text-[12.5px] leading-relaxed text-muted-foreground">{code[tab]}</pre>
        <div className="absolute top-2 right-2">
          <CopyBtn value={code[tab]} />
        </div>
      </div>
      <div className="border-t border-border px-4 py-2.5 text-xs text-subtle">
        Works with any OpenAI-compatible SDK or framework (LangChain, Vercel AI SDK, LlamaIndex…). Streaming, tools and JSON mode pass
        straight through.{" "}
        <Link to="/builder/docs" className="text-foreground underline decoration-dotted underline-offset-4">
          Full API reference →
        </Link>
      </div>
    </section>
  );
}
