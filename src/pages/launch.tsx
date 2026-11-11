import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Fingerprint,
  ImagePlus,
  Loader2,
  Lock,
  Rocket,
  ShieldCheck,
  XCircle,
} from "@/components/icons";
import { Cursor, Scramble } from "@/components/code-fx";
import { DISCLOSURE, GithubIcon, Redacted, XIcon } from "@/components/ui";
import { Identicon } from "@/components/icons";
import { http, USE_MOCK } from "@/lib/api";
import { APP_NAME, LOCK_MIN_MONTHS } from "@/lib/brand";
import { cn } from "@/lib/format";
import { LAUNCHPADS } from "@/lib/mock";
import { beginKyd, signAndSend, useKydStatus, useMe, useSignIn, waitForConfirmation } from "@/lib/session";
import type { Disclosure, LaunchpadId } from "@/lib/types";

const STEPS = ["Get doxed", "Launchpad", "Details", "Lock", "Launch"] as const;
const IN_APP: LaunchpadId[] = ["pumpfun", "meteora"];

type LaunchConfig = {
  pumpReady: boolean;
  launchFeeSol: number;
  meteoraTaxes: { taxBps: number; ready: boolean }[];
  meteoraPreset?: { supply: number; graduationMcapSol: number; creatorFeeShare: number };
};
const MOCK_CFG: LaunchConfig = {
  pumpReady: true,
  launchFeeSol: 0.1,
  meteoraTaxes: [100, 200, 300, 400, 500].map((taxBps) => ({ taxBps, ready: true })),
  meteoraPreset: { supply: 1e9, graduationMcapSol: 400, creatorFeeShare: 80 },
};
const useLaunchConfig = () =>
  useQuery({ queryKey: ["launch-config"], queryFn: () => (USE_MOCK ? Promise.resolve(MOCK_CFG) : http<LaunchConfig>("/launch/config")), staleTime: 60_000 });

type Form = {
  alias: string;
  disclosure: Disclosure;
  launchpad?: LaunchpadId;
  taxBps?: number;
  name: string;
  symbol: string;
  description: string;
  image?: File;
  imagePreview?: string;
  x: string;
  website: string;
  github: string;
  devBuy: string;
  months: number;
  agree: { lock: boolean; accurate: boolean; conduct: boolean };
};

const initial: Form = {
  alias: "",
  disclosure: "pseudonymous",
  name: "",
  symbol: "",
  description: "",
  x: "",
  website: "",
  github: "",
  devBuy: "0.5",
  months: LOCK_MIN_MONTHS,
  agree: { lock: false, accurate: false, conduct: false },
};

const url = (v: string) => (!v ? undefined : v.startsWith("http") ? v : `https://${v}`);

export function LaunchPage() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const { data: me } = useMe();
  const doxed = me?.dev?.status === "approved";

  useEffect(() => {
    if (me?.dev) setF((p) => ({ ...p, alias: p.alias || me.dev!.alias, disclosure: me.dev!.disclosure }));
  }, [me?.dev?.id]);

  const blockers = useMemo(() => {
    const b: string[][] = [[], [], [], [], []];
    if (!doxed) b[0].push("Finish the ID + face scan to continue.");
    if (!f.launchpad) b[1].push("Pick a launchpad.");
    if (f.launchpad === "meteora" && !f.taxBps) b[1].push("Pick your trading tax.");
    if (!f.image) b[2].push("Add a token image.");
    if (f.name.trim().length < 2) b[2].push("Add a token name.");
    if (!/^[A-Za-z0-9]{2,10}$/.test(f.symbol)) b[2].push("Ticker must be 2–10 letters or numbers.");
    if (!f.x && !f.website) b[2].push("Add an X account or website — the AI summary reads them.");
    if (!(Number(f.devBuy) >= 0.01)) b[2].push("Dev buy must be at least 0.01 SOL (it's what gets locked).");
    if (!f.agree.lock || !f.agree.accurate || !f.agree.conduct) b[3].push("Accept all three to continue.");
    return b;
  }, [f, doxed]);

  const canNext = blockers[step].length === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <section className="relative mb-6 overflow-hidden rounded-xl border border-border bg-card px-5 py-7 md:px-8">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(80%_90%_at_90%_0%,black,transparent)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-[4px] border border-border-strong px-2 py-1 font-pixel text-[10px] uppercase text-muted-foreground">
            <Rocket className="h-3 w-3" /> ~5 minutes · 2 wallet approvals
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold md:text-5xl">
            <Scramble text="Launch a token" />
            <Cursor />
          </h1>
          <p className="font-prose mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Scan your ID once, fill in your token, and approve twice in your wallet. We create it on the launchpad and lock your bag
            automatically.
          </p>
        </div>
      </section>

      <ol className="mb-6 grid grid-cols-5 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              disabled={i > step && blockers.slice(0, i).some((b) => b.length)}
              onClick={() => setStep(i)}
              className="w-full text-left disabled:cursor-not-allowed"
            >
              <div className="flex gap-[3px]">
                {Array.from({ length: 6 }, (_, j) => (
                  <span key={j} className={cn("h-1.5 flex-1", i <= step ? "bg-foreground" : "bg-white/10")} />
                ))}
              </div>
              <div className={cn("mt-2 hidden items-center gap-1.5 text-xs sm:flex", i === step ? "text-foreground" : "text-subtle")}>
                {i < step ? <Check className="h-3 w-3" /> : <span className="tabular">{i + 1}.</span>}
                {s}
              </div>
            </button>
          </li>
        ))}
      </ol>
      <div className="mb-4 text-xs text-subtle sm:hidden">
        Step {step + 1}/{STEPS.length} · <span className="text-foreground">{STEPS[step]}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card card-pad min-w-0">
          {step === 0 && <StepDoxed f={f} set={set} />}
          {step === 1 && <StepLaunchpad f={f} set={set} />}
          {step === 2 && <StepDetails f={f} set={set} />}
          {step === 3 && <StepLock f={f} set={set} />}
          {step === 4 && <StepLaunch f={f} goto={setStep} />}

          {step < 4 && (
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-ghost">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                {!canNext && <span className="text-xs text-muted-foreground">{blockers[step][0]}</span>}
                <button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="btn-primary">
                  Continue <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        <Preview f={f} doxed={doxed} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ preview
function Preview({ f, doxed }: { f: Form; doxed: boolean }) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-28 lg:self-start">
      <div className="eyebrow">How holders will see it</div>
      <div className="card p-4">
        <div className="flex items-center gap-3">
          {f.imagePreview ? (
            <img src={f.imagePreview} alt="" className="h-11 w-11 rounded-md border border-border-strong object-cover" />
          ) : (
            <Identicon seed={f.symbol || "TKN"} size={44} />
          )}
          <div className="min-w-0">
            <div className="truncate font-medium">{f.name || "Your token"}</div>
            <div className="font-mono text-xs text-subtle">${f.symbol.toUpperCase() || "TKN"}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {f.launchpad && <span className="chip border-border-strong text-muted-foreground">{LAUNCHPADS.find((l) => l.id === f.launchpad)?.name}</span>}
          {f.launchpad === "meteora" && f.taxBps && <span className="chip border-border-strong text-muted-foreground">Tax {f.taxBps / 100}%</span>}
          {doxed && (
            <span className="chip border-foreground/40 bg-foreground/10 text-foreground">
              <ShieldCheck className="h-3 w-3" /> DOXED · {DISCLOSURE[f.disclosure].short}
            </span>
          )}
          <span className="chip border-border-strong text-muted-foreground">
            <Lock className="h-3 w-3" /> 100% · {f.months}mo
          </span>
        </div>
        <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
          <Row label="Dev name" value={f.disclosure === "public" ? "Your legal name" : undefined} />
          <Row label="X" value={f.disclosure !== "private" && f.x ? f.x : undefined} />
          <Row label="GitHub" value={f.disclosure !== "private" && f.github ? f.github : undefined} />
        </div>
      </div>
      <div className="rounded-xl border border-border p-4 text-xs leading-relaxed text-muted-foreground">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <EyeOff className="h-3.5 w-3.5" /> Your privacy
        </div>
        <span className="font-prose">
          Your ID and face scan are handled by our verification partner and never shown publicly. Holders see the Doxed badge plus
          only what you choose to reveal.
        </span>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-subtle">{label}</span>
      {value ? <span className="truncate pl-3">{value}</span> : <Redacted w={70} />}
    </div>
  );
}

type StepProps = { f: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void };

function StepTitle({ title, desc }: { title: string; desc: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-xl font-medium">{title}</h2>
      <p className="font-prose mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

// ------------------------------------------------------------------ step 1: get doxed
function StepDoxed({ f, set }: StepProps) {
  const { data: me } = useMe();
  const signIn = useSignIn();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const { data: kyd } = useKydStatus(!!me?.wallet, open);
  const status = me?.dev?.status === "approved" ? "approved" : (kyd?.status ?? "none");

  useEffect(() => {
    if (kyd && ["approved", "rejected", "review"].includes(kyd.status)) {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["me"] });
    }
  }, [kyd?.status]);

  const start = async () => {
    setErr(null);
    setStarting(true);
    try {
      const r = await beginKyd(f.alias, f.disclosure);
      qc.setQueryData(["kyd"], r);
      if (r.status === "in_progress") setOpen(true);
      else qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <StepTitle title="Get doxed (privately)" desc={`Two quick scans with your phone or laptop camera. ${APP_NAME} only ever shows holders the result.`} />

      <ol className="grid gap-2 sm:grid-cols-3">
        {[
          ["Scan your ID", "Passport, ID card or driver's licence"],
          ["Face scan", "A quick selfie to prove it's really you"],
          ["AI checks", "Fake-ID, liveness, face match + risk review"],
        ].map(([t, d], i) => (
          <li key={t} className="rounded-lg border border-border bg-black/20 p-3">
            <div className="font-pixel text-[10px] text-subtle">0{i + 1}</div>
            <div className="mt-1 text-sm font-medium">{t}</div>
            <div className="font-prose text-xs text-muted-foreground">{d}</div>
          </li>
        ))}
      </ol>

      {!me?.wallet ? (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-border-strong p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">Connect the wallet you'll launch from. Signing in is free.</div>
          <button className="btn-primary" disabled={signIn.isPending} onClick={() => signIn.mutate(undefined, { onError: (e) => setErr((e as Error).message) })}>
            {signIn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />}
            {signIn.isPending ? "Waiting for wallet…" : "Connect wallet"}
          </button>
        </div>
      ) : status === "approved" ? (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-foreground/40 bg-foreground/5 p-4">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            <div className="font-medium">You're doxed as {me.dev?.alias}</div>
            <div className="text-xs text-subtle">Valid for all your future launches.</div>
          </div>
        </div>
      ) : status === "review" ? (
        <div className="mt-5 rounded-lg border border-dashed border-border-strong p-4">
          <div className="font-medium">Almost there — a person is double-checking your scan</div>
          <p className="font-prose mt-1 text-sm text-muted-foreground">
            Our automated checks wanted a second look. This usually takes under a day; come back to this page to continue.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {status === "rejected" && (
            <div className="rounded-lg border border-danger/40 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-danger">
                <XCircle className="h-4 w-4" /> Verification didn't pass
              </div>
              <ul className="font-prose mt-1 list-inside list-disc text-muted-foreground">
                {(kyd?.reasons ?? ["Please try again with a clear photo of a valid ID in good light."]).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm">Public alias</span>
            <input
              className="input"
              placeholder="e.g. orbitlabs"
              value={f.alias}
              maxLength={24}
              onChange={(e) => set("alias", e.target.value.replace(/[^\w.-]/g, ""))}
            />
          </label>
          <div>
            <div className="mb-2 text-sm">What should holders see?</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(DISCLOSURE) as Disclosure[]).map((k) => {
                const d = DISCLOSURE[k];
                const on = f.disclosure === k;
                return (
                  <button
                    key={k}
                    onClick={() => set("disclosure", k)}
                    aria-pressed={on}
                    className={cn("rounded-lg border p-3 text-left transition", on ? "border-foreground/60 bg-foreground/5" : "border-border hover:border-border-strong")}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <d.icon className="h-3.5 w-3.5" />
                      {d.short}
                    </div>
                    <p className="font-prose mt-1 text-xs text-muted-foreground">
                      {k === "private" && "Badge only. Nothing personal published."}
                      {k === "pseudonymous" && "Badge + your proven X and GitHub."}
                      {k === "public" && "Badge + your real name. Most trust."}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-subtle">You can reveal more later, never less.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-prose text-xs text-subtle">
              By continuing you consent to an ID and biometric check by our secure verification partner.
            </p>
            <button className="btn-primary" disabled={f.alias.length < 3 || starting} onClick={start}>
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {status === "in_progress" ? "Continue scan" : status === "rejected" ? "Try again" : "Start ID scan"}
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      {open && kyd?.url && <ScanModal url={kyd.url} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ScanModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="glass flex h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl sm:h-[780px] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="font-pixel text-[10px] uppercase text-muted-foreground">Secure ID + face scan</span>
          <div className="flex items-center gap-1">
            <a href={url} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1 text-xs">
              New tab <ExternalLink className="h-3 w-3" />
            </a>
            <button onClick={onClose} className="btn-ghost !px-2 !py-1 text-xs">
              Close
            </button>
          </div>
        </div>
        {USE_MOCK ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center font-mono text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
            Preview mode — simulating ID scan, face scan and AI checks…
          </div>
        ) : (
          <iframe src={url} title="ID verification" className="w-full flex-1 bg-white" allow="camera; microphone; fullscreen; autoplay; encrypted-media" />
        )}
        <div className="border-t border-border px-4 py-2 text-[11px] text-subtle">This closes by itself when your scan is checked.</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ step 2: launchpad
function StepLaunchpad({ f, set }: StepProps) {
  const { data: cfg } = useLaunchConfig();
  return (
    <div>
      <StepTitle title="Where do you want to launch?" desc="Your token is created natively on the launchpad. Doxing and the lock work the same on both." />
      <div className="grid gap-2 sm:grid-cols-2">
        {LAUNCHPADS.map((l) => {
          const ready = IN_APP.includes(l.id);
          const on = f.launchpad === l.id;
          return (
            <button
              key={l.id}
              disabled={!ready}
              onClick={() => set("launchpad", l.id)}
              aria-pressed={on}
              className={cn(
                "rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
                on ? "border-foreground/60 bg-foreground/5" : "border-border hover:border-border-strong",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2 w-2 bg-current" />
                  {l.name}
                </span>
                {on ? <CheckCircle2 className="h-4 w-4" /> : !ready && <span className="font-pixel text-[9px] uppercase text-subtle">Soon</span>}
              </div>
              <div className="font-prose mt-1 text-sm text-muted-foreground">{l.tagline}</div>
              {ready && <div className="mt-2 text-xs text-subtle">Graduates to {l.graduatesTo}</div>}
            </button>
          );
        })}
      </div>

      {f.launchpad === "meteora" && (
        <div className="mt-5 rounded-lg border border-border-strong p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium">Trading tax</div>
            <div className="text-xs text-subtle">Charged on every buy and sell, in SOL</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(cfg?.meteoraTaxes ?? []).map((t) => {
              const on = f.taxBps === t.taxBps;
              return (
                <button
                  key={t.taxBps}
                  disabled={!t.ready}
                  aria-pressed={on}
                  onClick={() => set("taxBps", t.taxBps)}
                  className={cn(
                    "rounded-md border py-2.5 text-center font-mono text-lg transition disabled:cursor-not-allowed disabled:opacity-40",
                    on ? "border-foreground bg-foreground text-background" : "border-border hover:border-border-strong",
                  )}
                >
                  {t.taxBps / 100}%
                  {!t.ready && <span className="block font-pixel text-[8px] uppercase">soon</span>}
                </button>
              );
            })}
            {!cfg && <div className="col-span-full text-xs text-subtle">Loading options…</div>}
          </div>
          {cfg?.meteoraPreset && (
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
              {[
                [`${cfg.meteoraPreset.creatorFeeShare}%`, "of the tax goes to you"],
                [`~${cfg.meteoraPreset.graduationMcapSol} SOL`, "market cap to graduate"],
                ["Same tax", "after graduation, LP locked forever"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-md border border-border bg-black/30 p-2">
                  <div className="font-mono text-sm">{v}</div>
                  <div className="text-subtle">{l}</div>
                </div>
              ))}
            </div>
          )}
          <p className="font-prose mt-3 text-xs text-muted-foreground">
            Everything else is a fixed preset — 1B supply, same curve for every launch — so holders know exactly what they're buying. Claimed tax shows up publicly in your fee history.
          </p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ step 3: details
function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-subtle">{hint}</span>}
    </label>
  );
}

function StepDetails({ f, set }: StepProps) {
  return (
    <div>
      <StepTitle title="Your token" desc="Links matter: our AI reads your X, website and GitHub to write the public summary and code review." />
      <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-border-strong text-xs text-subtle hover:border-foreground/50 hover:text-foreground">
          {f.imagePreview ? (
            <img src={f.imagePreview} alt="Token" className="h-full w-full object-cover" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" /> Image
            </>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2_000_000) return alert("Image must be under 2 MB.");
              set("image", file);
              set("imagePreview", URL.createObjectURL(file));
            }}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Name">
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Orbit Agents" maxLength={32} />
          </Field>
          <Field label="Ticker">
            <input
              className="input uppercase"
              value={f.symbol}
              onChange={(e) => set("symbol", e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
              placeholder="ORBIT"
              maxLength={10}
            />
          </Field>
        </div>
      </div>
      <div className="mt-4 grid gap-4">
        <Field label="Description" hint={`${f.description.length}/280`}>
          <textarea className="input h-24 resize-none py-2" value={f.description} onChange={(e) => set("description", e.target.value.slice(0, 280))} placeholder="One or two sentences on what this is." />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="X account">
            <div className="relative">
              <XIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
              <input className="input pl-8" value={f.x} onChange={(e) => set("x", e.target.value.trim())} placeholder="x.com/yourtoken" />
            </div>
          </Field>
          <Field label="Website">
            <input className="input" value={f.website} onChange={(e) => set("website", e.target.value.trim())} placeholder="yourtoken.xyz" />
          </Field>
          <Field label="GitHub" hint="Optional · unlocks code review">
            <div className="relative">
              <GithubIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
              <input className="input pl-8" value={f.github} onChange={(e) => set("github", e.target.value.trim())} placeholder="you/repo" />
            </div>
          </Field>
        </div>
        <Field label="Dev buy" hint="Bought at launch, then 100% of it is locked in the next step.">
          <div className="relative max-w-xs">
            <input className="input pr-14" inputMode="decimal" value={f.devBuy} onChange={(e) => set("devBuy", e.target.value.replace(/[^0-9.]/g, ""))} />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-subtle">SOL</span>
          </div>
        </Field>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ step 4: lock
function StepLock({ f, set }: StepProps) {
  const toggle = (k: keyof Form["agree"]) => set("agree", { ...f.agree, [k]: !f.agree[k] });
  const unlock = new Date(Date.now() + f.months * 30.44 * 864e5).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return (
    <div>
      <StepTitle title="Lock your bag" desc={`Everything your dev buy gets is locked on-chain — no cancel button, no early exit. Minimum ${LOCK_MIN_MONTHS} months.`} />
      <div className="rounded-lg border border-border-strong p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Lock length</span>
          <span className="font-mono text-2xl font-medium">{f.months} months</span>
        </div>
        <input
          type="range"
          min={LOCK_MIN_MONTHS}
          max={36}
          value={f.months}
          onChange={(e) => set("months", Number(e.target.value))}
          className="mt-3 w-full accent-[var(--foreground)]"
          aria-label="Lock length in months"
        />
        <div className="flex justify-between text-[11px] text-subtle">
          <span>{LOCK_MIN_MONTHS} mo minimum</span>
          <span>36 mo</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ["100%", "of your tokens"],
            [`${f.devBuy || 0} SOL`, "dev buy"],
            [unlock, "unlocks"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-md border border-border bg-black/30 p-2">
              <div className="font-mono text-sm font-medium">{v}</div>
              <div className="font-pixel text-[9px] uppercase text-subtle">{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {(
          [
            ["lock", `100% of my launch tokens are locked for ${f.months} months and can't be withdrawn early.`],
            ["accurate", "My links and details are accurate and I control them."],
            ["conduct", `If I break ${APP_NAME}'s rules, my doxed profile is publicly flagged and I can't launch again.`],
          ] as [keyof Form["agree"], string][]
        ).map(([k, l]) => (
          <label key={k} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition", f.agree[k] ? "border-foreground/50 bg-foreground/5" : "border-border hover:border-border-strong")}>
            <input type="checkbox" checked={f.agree[k]} onChange={() => toggle(k)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--foreground)]" />
            <span className="font-prose text-muted-foreground">{l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ step 5: launch pipeline
type Phase = { key: string; label: string };
const PHASES: Phase[] = [
  { key: "meta", label: "Upload image + metadata" },
  { key: "build", label: "Build launch transaction" },
  { key: "sign1", label: "Approve launch in your wallet" },
  { key: "confirm1", label: "Create token + dev buy on-chain" },
  { key: "sign2", label: "Approve lock in your wallet" },
  { key: "confirm2", label: "Lock 100% of your tokens" },
  { key: "verify", label: "Verify lock + go live" },
];

function StepLaunch({ f, goto }: { f: Form; goto: (n: number) => void }) {
  const lp = LAUNCHPADS.find((l) => l.id === f.launchpad);
  const { data: cfg } = useLaunchConfig();
  const [at, setAt] = useState(-1);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [mint, setMint] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const running = at >= 0 && !done && !err;
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);
  const say = (s: string) => setLog((l) => [...l, s]);

  const blocked =
    !!cfg &&
    (f.launchpad === "pumpfun" ? !cfg.pumpReady : f.launchpad === "meteora" ? !cfg.meteoraTaxes.find((t) => t.taxBps === f.taxBps)?.ready : false);

  async function run(from = 0) {
    setErr(null);
    let m = mint;
    try {
      if (USE_MOCK) {
        for (let i = from; i < PHASES.length; i++) {
          setAt(i);
          say(`→ ${PHASES[i].label}…`);
          await new Promise((r) => setTimeout(r, i === 2 || i === 4 ? 1400 : 800));
        }
        m = "DemoMint1111111111111111111111111111111111";
        setMint(m);
        say("✓ live on Discover");
        setDone(true);
        return;
      }
      if (from <= 3) {
        setAt(0);
        say("$ doxed upload --image " + (f.image?.name ?? "token.png"));
        const fd = new FormData();
        fd.append("image", f.image!);
        fd.append("launchpad", f.launchpad!);
        fd.append("name", f.name.trim());
        fd.append("symbol", f.symbol);
        if (f.description) fd.append("description", f.description);
        if (f.x) fd.append("x", url(f.x)!);
        if (f.website) fd.append("website", url(f.website)!);
        const meta = await http<{ uri: string; image: string }>("/launch/metadata", { method: "POST", body: fd });
        say(`  metadata → ${meta.uri.slice(0, 48)}…`);

        setAt(1);
        say(`$ doxed create $${f.symbol} --on ${f.launchpad} --dev-buy ${f.devBuy}${f.launchpad === "meteora" ? ` --tax ${f.taxBps! / 100}%` : ""}`);
        const built = await http<{ mint: string; tx: string }>("/launch/create-tx", {
          method: "POST",
          json: {
            launchpad: f.launchpad,
            taxBps: f.launchpad === "meteora" ? f.taxBps : undefined,
            name: f.name.trim(),
            symbol: f.symbol,
            description: f.description || undefined,
            uri: meta.uri,
            image: meta.image,
            x: url(f.x),
            website: url(f.website),
            github: f.github || undefined,
            devBuySol: Number(f.devBuy),
            lockMonths: f.months,
          },
        });
        m = built.mint;
        setMint(m);
        say(`  mint → ${m}`);

        setAt(2);
        say("  waiting for wallet approval (1/2)…");
        const sig1 = await signAndSend(built.tx);
        setAt(3);
        say(`  sent ${sig1.slice(0, 10)}… confirming`);
        await waitForConfirmation(sig1);
        await http(`/launch/${m}/created`, { method: "POST", json: { signature: sig1 } });
        say("✓ token created + dev buy filled");
      }

      setAt(4);
      say(`$ doxed lock --all --months ${f.months}`);
      let lock: { tx: string; lockId: string };
      for (let i = 0; ; i++) {
        try {
          lock = await http<{ tx: string; lockId: string }>(`/launch/${m}/lock-tx`, { method: "POST" });
          break;
        } catch (e) {
          if (i >= 4) throw e;
          say("  waiting for balance to settle…");
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      say("  waiting for wallet approval (2/2)…");
      const sig2 = await signAndSend(lock.tx);
      setAt(5);
      say(`  sent ${sig2.slice(0, 10)}… confirming`);
      await waitForConfirmation(sig2);
      say(`✓ locked → contract ${lock.lockId.slice(0, 8)}…`);

      setAt(6);
      for (let i = 0; ; i++) {
        try {
          await http(`/launches/${m}/verify-lock`, { method: "POST", json: { signature: sig2 } });
          break;
        } catch (e) {
          if (i >= 5) throw e;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      say("✓ lock verified · live on Discover");
      setDone(true);
    } catch (e) {
      const msg = (e as Error).message || "Something went wrong";
      setErr(/reject|declin|cancel/i.test(msg) ? "You cancelled in your wallet. Nothing was charged for this step." : msg);
      say(`✗ ${msg}`);
    }
  }

  const resumeFrom = at >= 4 && mint ? 4 : 0;

  if (done && mint)
    return (
      <div className="py-6 text-center">
        <div className="mx-auto inline-flex rounded-md border border-border-strong p-3">
          <Rocket className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-3xl font-semibold">${f.symbol} is live</h2>
        <p className="font-prose mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Created on {lp?.name}, 100% of your tokens locked for {f.months} months, and your Doxed badge is on the token page. The AI
          summary appears once it has read your links.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/token/$mint" params={{ mint }} className="btn-primary">
            View token page <ArrowRight className="h-3 w-3" />
          </Link>
          <a
            href={`https://x.com/intent/post?text=${encodeURIComponent(`$${f.symbol} just launched on ${APP_NAME} — dev doxed, bag locked ${f.months} months.`)}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            <XIcon className="h-3.5 w-3.5" /> Share
          </a>
        </div>
      </div>
    );

  return (
    <div>
      <StepTitle title="Ready to launch" desc="One button. You'll approve twice in your wallet: once to create the token, once to lock it." />
      <dl className="divide-y divide-border rounded-lg border border-border text-sm">
        {(
          [
            ["Token", `${f.name} ($${f.symbol})`, 2],
            ["Launchpad", f.launchpad === "meteora" && f.taxBps ? `${lp?.name} · ${f.taxBps / 100}% trading tax` : lp?.name, 1],
            ["Dev buy", `${f.devBuy} SOL`, 2],
            ["Lock", `100% for ${f.months} months`, 3],
            ...(cfg?.launchFeeSol ? ([["Platform fee", `${cfg.launchFeeSol} SOL · includes $100/mo Builder API credit`, 4]] as [string, ReactNode, number][]) : []),
          ] as [string, ReactNode, number][]
        ).map(([l, v, s]) => (
          <div key={l} className="flex items-center gap-3 px-4 py-2.5">
            <dt className="w-24 shrink-0 text-subtle">{l}</dt>
            <dd className="min-w-0 flex-1 truncate">{v}</dd>
            {!running && at < 0 && (
              <button onClick={() => goto(s)} className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">
                Edit
              </button>
            )}
          </div>
        ))}
      </dl>

      {at >= 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
          <ol className="space-y-1.5 text-xs">
            {PHASES.map((p, i) => (
              <li key={p.key} className={cn("flex items-center gap-2", i < at || done ? "text-foreground" : i === at ? "text-foreground" : "text-subtle")}>
                {i < at || done ? (
                  <Check className="h-3 w-3" />
                ) : i === at && err ? (
                  <XCircle className="h-3 w-3 text-danger" />
                ) : i === at ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="h-3 w-3 border border-subtle" />
                )}
                {p.label}
              </li>
            ))}
          </ol>
          <div ref={logRef} className="scanline h-48 overflow-auto rounded-md border border-border bg-black/50 p-3 font-mono text-[12px] leading-relaxed text-muted-foreground">
            {log.map((l, i) => (
              <div key={i} className={l.startsWith("✓") ? "text-foreground" : l.startsWith("✗") ? "text-danger" : ""}>
                {l}
              </div>
            ))}
            {running && <Cursor />}
          </div>
        </div>
      )}

      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      {blocked && <p className="mt-3 text-sm text-muted-foreground">{lp?.name} launches{f.launchpad === "meteora" ? ` at ${f.taxBps! / 100}% tax` : ""} aren't switched on yet — go back and pick another option.</p>}

      <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={() => goto(3)} disabled={running} className="btn-ghost">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <button onClick={() => run(err ? resumeFrom : 0)} disabled={running || !!blocked} className="btn-primary">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
          {running ? "Launching…" : err ? (resumeFrom === 4 ? "Retry lock" : "Try again") : `Launch on ${lp?.name}`}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-subtle">
        Launchpad and network fees are paid from your wallet. Your token only appears on Discover after the lock is verified.
      </p>
    </div>
  );
}
