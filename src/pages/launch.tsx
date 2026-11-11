import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  EyeOff,
  Fingerprint,
  ImagePlus,
  Loader2,
  Lock,
  PartyPopper,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { LAUNCHPADS } from "@/lib/mock";
import { APP_NAME, LOCK_MIN_MONTHS } from "@/lib/brand";
import { cn } from "@/lib/format";
import type { Disclosure, LaunchpadId } from "@/lib/types";
import { DISCLOSURE, GithubIcon, LaunchpadChip, Redacted, TokenIcon, XIcon } from "@/components/ui";

const STEPS = ["Verify yourself", "Pick a launchpad", "Token details", "Lock & terms", "Review"] as const;

type Form = {
  kyd: "none" | "checking" | "done";
  disclosure: Disclosure;
  launchpad?: LaunchpadId;
  name: string;
  symbol: string;
  description: string;
  image?: string;
  x: string;
  website: string;
  github: string;
  devBuy: string;
  months: number;
  agree: { lock: boolean; accurate: boolean; conduct: boolean };
};

const initial: Form = {
  kyd: "none",
  disclosure: "private",
  name: "",
  symbol: "",
  description: "",
  x: "",
  website: "",
  github: "",
  devBuy: "1",
  months: LOCK_MIN_MONTHS,
  agree: { lock: false, accurate: false, conduct: false },
};

export function LaunchPage() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(initial);
  const [launched, setLaunched] = useState<"no" | "sending" | "yes">("no");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const blockers = useMemo(() => {
    const b: string[][] = [[], [], [], [], []];
    if (f.kyd !== "done") b[0].push("Finish identity verification to continue.");
    if (!f.launchpad) b[1].push("Choose where your token will launch.");
    if (f.name.trim().length < 2) b[2].push("Add a token name.");
    if (!/^[A-Za-z0-9]{2,10}$/.test(f.symbol)) b[2].push("Ticker must be 2–10 letters or numbers.");
    if (!f.x && !f.website) b[2].push("Add at least an X account or website — that's what the AI summary reads.");
    if (!(Number(f.devBuy) >= 0)) b[2].push("Dev buy must be a number.");
    if (!f.agree.lock || !f.agree.accurate || !f.agree.conduct) b[3].push("Accept all three terms to continue.");
    return b;
  }, [f]);

  if (launched === "yes") return <Success f={f} />;

  const canNext = blockers[step].length === 0;
  const preview = { symbol: f.symbol.toUpperCase() || "TKN", hue: 148 };

  return (
    <div className="mx-auto max-w-5xl">
      <section className="aurora relative mb-6 overflow-hidden rounded-3xl border border-border px-5 py-7 md:px-8">
                <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Rocket className="h-3 w-3" /> About 5 minutes
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">Launch a token</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">Verify once, then launch on the launchpad you prefer — we handle the lock.</p>
        </div>
      </section>

      {/* Stepper */}
      <ol className="mb-6 grid grid-cols-5 gap-1.5">
        {STEPS.map((s, i) => {
          const done = i < step;
          const cur = i === step;
          return (
            <li key={s}>
              <button
                disabled={i > step && blockers.slice(0, i).some((b) => b.length)}
                onClick={() => setStep(i)}
                className="group w-full text-left disabled:cursor-not-allowed"
              >
                <div className={cn("h-1 rounded-full transition", done || cur ? "bg-primary" : "bg-muted")} />
                <div className={cn("mt-2 hidden items-center gap-1.5 text-xs sm:flex", cur ? "text-foreground" : "text-subtle")}>
                  {done ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="tabular">{i + 1}.</span>}
                  {s}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mb-4 text-xs text-subtle sm:hidden">
        Step {step + 1} of {STEPS.length} · <span className="text-foreground">{STEPS[step]}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card card-pad min-w-0">
          {step === 0 && <StepVerify f={f} set={set} />}
          {step === 1 && <StepLaunchpad f={f} set={set} />}
          {step === 2 && <StepDetails f={f} set={set} />}
          {step === 3 && <StepLock f={f} set={set} />}
          {step === 4 && <StepReview f={f} goto={setStep} />}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-ghost">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              {!canNext && <span className="text-xs text-warning">{blockers[step][0]}</span>}
              {step < 4 ? (
                <button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="btn-primary">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setLaunched("sending");
                    setTimeout(() => setLaunched("yes"), 1400);
                  }}
                  disabled={launched === "sending"}
                  className="btn-primary"
                >
                  {launched === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {launched === "sending" ? "Launching & locking…" : "Launch token"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="eyebrow">How holders will see it</div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              {f.image ? (
                <img src={f.image} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <TokenIcon t={preview} size={44} />
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold">{f.name || "Your token"}</div>
                <div className="font-mono text-xs text-subtle">${preview.symbol}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {f.launchpad && <LaunchpadChip id={f.launchpad} />}
              {f.kyd === "done" && (
                <span className="chip border-primary/30 bg-primary/10 text-primary">
                  <ShieldCheck className="h-3 w-3" /> KYD · {DISCLOSURE[f.disclosure].short}
                </span>
              )}
              <span className="chip border-border-strong text-muted-foreground">
                <Lock className="h-3 w-3 text-primary" /> 100% · {f.months}mo
              </span>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
              <PreviewRow label="Dev name" value={f.disclosure === "public" ? "Your legal name" : undefined} />
              <PreviewRow label="X" value={f.disclosure !== "private" && f.x ? f.x : undefined} />
              <PreviewRow label="GitHub" value={f.disclosure !== "private" && f.github ? f.github : undefined} />
            </div>
          </div>
          <div className="rounded-xl border border-border p-4 text-xs leading-relaxed text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
              <EyeOff className="h-3.5 w-3.5" /> Your privacy
            </div>
            Your ID documents are never shown publicly. Holders only see that you're verified, plus whatever you choose to
            reveal. You can reveal more later, but not less.
          </div>
        </aside>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value?: string }) {
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
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function StepVerify({ f, set }: StepProps) {
  return (
    <div>
      <StepTitle
        title="Know Your Dev"
        desc={`Verify your identity privately with ${APP_NAME}. It's a one-time check and lets every future launch carry the verified badge.`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <div className="eyebrow mb-2">We check privately</div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {["Government photo ID", "Quick selfie (liveness)", "Sanctions screening", "A signature from your launch wallet"].map((x) => (
              <li key={x} className="flex gap-2">
                <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-subtle" /> {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="eyebrow mb-2">Holders see</div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {["A verified badge and the date you verified", "Which checks you passed", "Only the details you choose below"].map((x) => (
              <li key={x} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {x}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border-strong bg-background/50 p-4">
        {f.kyd === "done" ? (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
              <Check className="h-5 w-5 text-primary" />
            </span>
            <div>
              <div className="font-medium">You're verified</div>
              <div className="text-xs text-subtle">Wallet 7xKp…9fQa · valid for future launches</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">Takes about 2 minutes on your phone or laptop camera.</div>
            <button
              className="btn-primary"
              disabled={f.kyd === "checking"}
              onClick={() => {
                set("kyd", "checking");
                setTimeout(() => set("kyd", "done"), 1300);
              }}
            >
              {f.kyd === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {f.kyd === "checking" ? "Checking…" : "Start verification"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">What should holders see?</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(DISCLOSURE) as Disclosure[]).map((k) => {
            const d = DISCLOSURE[k];
            const on = f.disclosure === k;
            return (
              <button
                key={k}
                onClick={() => set("disclosure", k)}
                aria-pressed={on}
                className={cn("rounded-xl border p-3.5 text-left transition", on ? "border-primary/50 bg-primary/5 glow-ring" : "border-border hover:border-border-strong")}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <d.icon className={cn("h-4 w-4", on ? "text-primary" : "text-subtle")} />
                  {d.short}
                  {k === "pseudonymous" && <span className="chip ml-auto border-primary/30 text-[10px] text-primary">Popular</span>}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {k === "private" && "Badge only. Nothing personal is published."}
                  {k === "pseudonymous" && "Show your proven X and GitHub, no real name."}
                  {k === "public" && "Show your real name too. Highest holder trust."}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepLaunchpad({ f, set }: StepProps) {
  return (
    <div>
      <StepTitle title="Where do you want to launch?" desc="Your token is created natively on the launchpad you choose. Verification and the lock work the same on all of them." />
      <div className="grid gap-2 sm:grid-cols-2">
        {LAUNCHPADS.map((l) => {
          const on = f.launchpad === l.id;
          return (
            <button
              key={l.id}
              disabled={!l.available}
              onClick={() => set("launchpad", l.id)}
              aria-pressed={on}
              className={cn(
                "rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                on ? "border-primary/50 bg-primary/5 glow-ring" : "border-border hover:border-border-strong",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </span>
                {on ? <CheckCircle2 className="h-4 w-4 text-primary" /> : !l.available && <span className="text-[11px] text-subtle">Soon</span>}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{l.tagline}</div>
              <div className="mt-3 space-y-0.5 text-xs text-subtle">
                <div>Best for: {l.bestFor}</div>
                {l.available && <div>Graduates to: {l.graduatesTo}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-subtle">{hint}</span>}
    </label>
  );
}

function StepDetails({ f, set }: StepProps) {
  return (
    <div>
      <StepTitle title="Tell people about your token" desc="Links matter: our AI reads your X, website and GitHub to write the public summary and code review." />
      <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed border-border-strong text-xs text-subtle hover:border-primary/50 hover:text-foreground">
          {f.image ? (
            <img src={f.image} alt="Token" className="h-full w-full object-cover" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" /> Image
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) set("image", URL.createObjectURL(file));
            }}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Name">
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Orbit Agents" maxLength={32} />
          </Field>
          <Field label="Ticker">
            <input
              className="input font-mono uppercase"
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
          <textarea
            className="input h-24 resize-none py-2"
            value={f.description}
            onChange={(e) => set("description", e.target.value.slice(0, 280))}
            placeholder="One or two sentences on what this is."
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="X account">
            <div className="relative">
              <XIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
              <input className="input pl-8" value={f.x} onChange={(e) => set("x", e.target.value)} placeholder="x.com/yourtoken" />
            </div>
          </Field>
          <Field label="Website">
            <input className="input" value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </Field>
          <Field label="GitHub (optional)" hint="Unlocks the AI code review">
            <div className="relative">
              <GithubIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
              <input className="input pl-8" value={f.github} onChange={(e) => set("github", e.target.value)} placeholder="github.com/you/repo" />
            </div>
          </Field>
        </div>
        <Field label="Dev buy" hint="Tokens you buy at launch. All of them go straight into the lock in the next step.">
          <div className="relative max-w-xs">
            <input className="input pr-14" inputMode="decimal" value={f.devBuy} onChange={(e) => set("devBuy", e.target.value)} />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-subtle">SOL</span>
          </div>
        </Field>
      </div>
    </div>
  );
}

function StepLock({ f, set }: StepProps) {
  const toggle = (k: keyof Form["agree"]) => set("agree", { ...f.agree, [k]: !f.agree[k] });
  return (
    <div>
      <StepTitle
        title="Lock your tokens"
        desc={`Every token you hold at launch is locked on-chain with Streamflow. Minimum ${LOCK_MIN_MONTHS} months — longer locks show more commitment.`}
      />
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Lock length</span>
          <span className="font-display text-2xl font-semibold">{f.months} months</span>
        </div>
        <input
          type="range"
          min={LOCK_MIN_MONTHS}
          max={36}
          step={1}
          value={f.months}
          onChange={(e) => set("months", Number(e.target.value))}
          className="mt-3 w-full accent-[var(--primary)]"
          aria-label="Lock length in months"
        />
        <div className="flex justify-between text-[11px] text-subtle">
          <span>{LOCK_MIN_MONTHS} mo (minimum)</span>
          <span>36 mo</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-background/60 p-2">
            <div className="font-display text-base font-semibold">100%</div>
            <div className="text-subtle">of dev tokens</div>
          </div>
          <div className="rounded-lg bg-background/60 p-2">
            <div className="font-display text-base font-semibold">{f.devBuy || 0} SOL</div>
            <div className="text-subtle">dev buy</div>
          </div>
          <div className="rounded-lg bg-background/60 p-2">
            <div className="font-display text-base font-semibold">
              {new Date(Date.now() + f.months * 30.44 * 864e5).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </div>
            <div className="text-subtle">unlocks</div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {(
          [
            ["lock", `I understand 100% of my launch tokens are locked for ${f.months} months and can't be withdrawn early.`],
            ["accurate", "The links and details I gave are accurate and I control them."],
            ["conduct", `If I break ${APP_NAME}'s launch rules, my verified profile will be publicly flagged and I can't launch again.`],
          ] as [keyof Form["agree"], string][]
        ).map(([k, l]) => (
          <label key={k} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition", f.agree[k] ? "border-primary/30 bg-primary/5" : "border-border hover:border-border-strong")}>
            <input type="checkbox" checked={f.agree[k]} onChange={() => toggle(k)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" />
            <span className="text-muted-foreground">{l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function StepReview({ f, goto }: { f: Form; goto: (n: number) => void }) {
  const lp = LAUNCHPADS.find((l) => l.id === f.launchpad);
  const rows: [string, ReactNode, number][] = [
    ["Identity", `Verified · shown as ${DISCLOSURE[f.disclosure].short.toLowerCase()}`, 0],
    ["Launchpad", lp?.name, 1],
    ["Token", `${f.name} ($${f.symbol})`, 2],
    ["Links", [f.x, f.website, f.github].filter(Boolean).join(" · ") || "—", 2],
    ["Dev buy", `${f.devBuy} SOL`, 2],
    ["Lock", `100% of dev tokens for ${f.months} months (Streamflow)`, 3],
  ];
  return (
    <div>
      <StepTitle title="Check everything" desc="You'll sign twice: once to create the token and make your dev buy, then once to lock those tokens. The token only gets its verified badge after the lock confirms." />
      <dl className="divide-y divide-border rounded-xl border border-border">
        {rows.map(([l, v, s]) => (
          <div key={l} className="flex items-center gap-3 px-4 py-3 text-sm">
            <dt className="w-24 shrink-0 text-subtle">{l}</dt>
            <dd className="min-w-0 flex-1 truncate">{v}</dd>
            <button onClick={() => goto(s)} className="text-xs text-primary hover:underline">
              Edit
            </button>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-subtle">
        Launchpad fees are paid to {lp?.name ?? "the launchpad"} as normal. After launch, your token page goes live with the AI
        summary within a few minutes.
      </p>
    </div>
  );
}

function Success({ f }: { f: Form }) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
        <PartyPopper className="h-7 w-7 text-primary" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold">${f.symbol} is live</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your dev tokens are locked for {f.months} months and your verified badge is on the token page. The AI summary will
        appear once it has read your links.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/" className="btn-primary">
          See it on Discover
        </Link>
        <a href="https://x.com/intent/post" target="_blank" rel="noreferrer" className="btn-ghost">
          <XIcon className="h-4 w-4" /> Share
        </a>
      </div>
    </div>
  );
}
