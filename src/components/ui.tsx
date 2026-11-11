import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Copy, Eye, EyeOff, Globe, Lock, ShieldCheck, UserRound } from "@/components/icons";
import { Link } from "@tanstack/react-router";
import { launchpadById } from "@/lib/api";
import { Identicon } from "./icons";
import { cn, short } from "@/lib/format";
import type { Dev, Disclosure, LaunchpadId, Token } from "@/lib/types";

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function TokenIcon({ t, size = 40 }: { t: Pick<Token, "symbol" | "hue">; size?: number }) {
  return <Identicon seed={t.symbol + t.hue} size={size} />;
}

export function LaunchpadChip({ id, className }: { id: LaunchpadId; className?: string }) {
  const lp = launchpadById(id);
  return (
    <span className={cn("chip border-border-strong text-muted-foreground", className)}>
      <span className="h-1.5 w-1.5 bg-current" />
      {lp.name}
    </span>
  );
}

export const DISCLOSURE: Record<Disclosure, { label: string; short: string; desc: string; icon: typeof Eye }> = {
  private: {
    label: "Doxed · Private",
    short: "Private",
    desc: "Doxed to us, not to you. Identity checked and kept confidential — nothing personal is shown publicly.",
    icon: EyeOff,
  },
  pseudonymous: {
    label: "Doxed · Socials",
    short: "Socials",
    desc: "Identity checked by us. The dev also publicly linked the X / GitHub accounts they proved they own.",
    icon: UserRound,
  },
  public: {
    label: "Doxed · Public",
    short: "Public",
    desc: "Fully doxed. Identity checked by us and the dev chose to show their real name publicly.",
    icon: Eye,
  },
};

/** Compact trust badge with a hover/focus explainer. */
export function KydBadge({ dev, size = "sm" }: { dev: Dev; size?: "sm" | "md" }) {
  const d = DISCLOSURE[dev.disclosure];
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        className={cn(
          "chip cursor-help border-foreground/40 bg-foreground/10 text-foreground",
          size === "md" && "px-2.5 py-1 text-xs",
        )}
      >
        <ShieldCheck className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
        {size === "md" ? d.label : `DOXED · ${d.short}`}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full right-0 z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-border-strong bg-[#0b0b0b]/95 p-3 text-xs leading-relaxed text-muted-foreground tip shadow-xl"
      >
        <span className="mb-1 block font-semibold text-foreground">{d.label}</span>
        {d.desc}
      </span>
    </span>
  );
}

export function Redacted({ w = 96 }: { w?: number }) {
  return <span className="redacted" style={{ width: w }} aria-label="Redacted" />;
}

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background/40 px-2 py-0.5 font-mono text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground",
        className,
      )}
      title="Copy"
    >
      {label ?? short(value, 4, 4)}
      {ok ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function Sparkline({ data, up, className }: { data: number[]; up: boolean; className?: string }) {
  const pts = data.slice(-40);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const d = pts
    .map((v, i) => `${(i / (pts.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 28 - 1}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-24", className)} aria-hidden>
      <polyline points={d} fill="none" stroke={up ? "var(--success)" : "var(--danger)"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PriceChart({ data, up }: { data: number[]; up: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const W = 600;
  const Hh = 220;
  const xy = data.map((v, i) => [(i / (data.length - 1)) * W, Hh - ((v - min) / (max - min || 1)) * (Hh - 16) - 8]);
  const line = xy.map((p) => p.join(",")).join(" ");
  const area = `0,${Hh} ${line} ${W},${Hh}`;
  const c = "var(--foreground)";
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" className="h-56 w-full" role="img" aria-label="Price history">
      <defs>
        <linearGradient id="pc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.14" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={Hh * f} y2={Hh * f} stroke="var(--border)" strokeDasharray="3 5" />
      ))}
      <polygon points={area} fill="url(#pc-fill)" />
      <polyline points={line} fill="none" stroke={c} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {!up && <text x={W - 6} y={14} textAnchor="end" fill="var(--danger)" fontSize="11" fontFamily="var(--font-mono)">▼</text>}
    </svg>
  );
}

/** Segmented pixel progress bar for time-based locks. */
export function LockProgress({ startsAt, unlocksAt }: { startsAt: string; unlocksAt: string }) {
  const st = Date.parse(startsAt);
  const e = Date.parse(unlocksAt);
  const p = Math.min(100, Math.max(0, ((Date.now() - st) / (e - st)) * 100));
  const daysLeft = Math.max(0, Math.ceil((e - Date.now()) / 86_400_000));
  const SEG = 24;
  const filled = Math.max(1, Math.round((p / 100) * SEG));
  return (
    <div>
      <div className="flex gap-[3px]">
        {Array.from({ length: SEG }, (_, i) => (
          <span key={i} className={cn("h-2.5 flex-1", i < filled ? "bg-foreground" : "bg-white/10")} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-subtle">
        <span>{p.toFixed(0)}% elapsed</span>
        <span>{daysLeft}d left</span>
      </div>
    </div>
  );
}

export function LockedPill({ unlocksAt }: { unlocksAt: string }) {
  const months = Math.max(0, Math.round((Date.parse(unlocksAt) - Date.now()) / (30 * 86_400_000)));
  return (
    <span className="chip border-border-strong bg-background/40 text-muted-foreground">
      <Lock className="h-3 w-3" />
      {months}mo
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon,
  right,
  children,
  className,
  id,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-strong bg-white/[0.04] text-foreground [&_svg]:h-4 [&_svg]:w-4">
              {icon}
            </div>
          )}
          <div>
            <h2 className="font-display text-base font-medium text-foreground">{title}</h2>
            {subtitle && <p className="text-[11px] text-subtle">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Hero stat card — identical to EZ Screener's StatCard. */
export function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon?: typeof Eye; accent?: boolean }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card px-4 py-4 transition hover:border-border-strong",
        accent ? "border-border-strong" : "border-border",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          accent ? "via-white/60" : "via-white/10",
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="font-pixel text-[10px] uppercase text-subtle">{label}</div>
        {Icon && <Icon className={cn("h-3.5 w-3.5", accent ? "text-foreground" : "text-subtle")} />}
      </div>
      <div className="mt-2 font-mono text-2xl font-medium tracking-tight md:text-[28px]">{value}</div>
    </div>
  );
}

/** Glowing contract-address pill from the EZ Screener hero. */
export function CaButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-2.5 py-1 font-mono text-xs transition-all active:scale-[0.97] sm:gap-2.5 sm:px-3 sm:py-1.5 sm:text-sm",
        copied ? "border-foreground bg-foreground text-background" : "border-border-strong bg-card text-foreground hover:border-foreground/50",
      )}
      title="Copy contract address"
    >
      <span className="font-pixel text-[10px] uppercase opacity-60">{copied ? "Copied" : "CA"}</span>
      <span className="font-medium">{short(value, 4, 4)}</span>
      <span className="flex items-center justify-center opacity-60 group-hover:opacity-100">
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </span>
    </button>
  );
}

/** "Label  Value ▾" select, as in the EZ Screener filter bar. */
export function FilterSelect<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <label className="relative inline-flex h-9 min-w-0 items-center gap-1.5 rounded-md border border-border bg-card pr-8 pl-3 text-[13px] transition hover:border-border-strong focus-within:border-foreground/50">
      <span className="text-subtle">{label}</span>
      <select
        value={String(value)}
        onChange={(e) => {
          const o = options.find((x) => String(x.value) === e.target.value);
          if (o) onChange(o.value);
        }}
        className="min-w-0 flex-1 truncate appearance-none bg-transparent font-medium text-foreground outline-none"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-muted-foreground" />
    </label>
  );
}

/** CA copy + website + X buttons under each token name. */
export function TokenQuickLinks({ t }: { t: Pick<Token, "mint" | "links"> }) {
  const box = "grid h-7 w-7 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground";
  return (
    <div className="flex flex-nowrap items-center gap-1">
      <CopyButton value={t.mint} className="rounded-md border-border bg-card px-2 py-1 font-medium" />
      {t.links.website && (
        <a href={t.links.website} target="_blank" rel="noreferrer" title="Website" className={box}>
          <Globe className="h-3.5 w-3.5" />
        </a>
      )}
      {t.links.x && (
        <a href={t.links.x} target="_blank" rel="noreferrer" title="X / Twitter" className={box}>
          <XIcon className="h-3.5 w-3.5" />
        </a>
      )}
      {t.links.github && (
        <a href={t.links.github} target="_blank" rel="noreferrer" title="GitHub" className={box}>
          <GithubIcon className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

/** Small round "verified dev" mark shown next to a ticker (like the EZ verified badge). */
export function KydMark({ dev, size = 16 }: { dev: Dev; size?: number }) {
  return (
    <span className="group relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <span
        tabIndex={0}
        className="inline-flex cursor-help items-center justify-center rounded-[3px] bg-foreground text-background"
        style={{ width: size, height: size }}
        aria-label={DISCLOSURE[dev.disclosure].label}
      >
        <ShieldCheck style={{ width: size * 0.66, height: size * 0.66 }} strokeWidth={2.5} />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-40 font-prose mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-md border border-border-strong bg-[#0b0b0b]/95 p-3 text-left text-xs font-normal leading-relaxed text-muted-foreground tip shadow-xl"
      >
        <span className="mb-1 block font-semibold text-foreground">{DISCLOSURE[dev.disclosure].label}</span>
        {DISCLOSURE[dev.disclosure].desc}
      </span>
    </span>
  );
}

/** KPI tile — both EZ Screener variants (default and "cyber"). */
export function Kpi({
  label,
  value,
  icon,
  size = "md",
  variant = "default",
  change,
  sub,
  className,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  size?: "md" | "lg";
  variant?: "default" | "cyber";
  change?: number;
  sub?: ReactNode;
  className?: string;
}) {
  const lg = size === "lg";
  if (variant === "cyber") {
    return (
      <div className={cn("group relative", className)}>
                <div className="relative flex h-full min-h-[8rem] flex-col justify-between rounded-xl border border-border-strong bg-card p-4 transition group-hover:border-foreground/40">
          <div className="flex items-center gap-2">
            <div className="rounded-[4px] border border-border-strong p-1.5 text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</div>
            <span className="font-pixel text-[10px] uppercase text-subtle">{label}</span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className={cn("font-mono font-medium tracking-tight", lg ? "text-3xl" : "text-2xl")}>{value}</div>
              {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
            </div>
            {change != null && change !== 0 && (
              <div className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold", change > 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
                {change > 0 ? "↑" : "↓"}
                {Math.abs(change).toFixed(2)}%
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col justify-between rounded-xl border border-border bg-card", lg ? "p-5" : "p-4", className)}>
      <div className="flex items-center gap-1.5 font-pixel text-[10px] uppercase text-subtle [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className={cn("mt-2 font-mono font-medium tracking-tight", lg ? "text-3xl" : "text-2xl")}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function DevLink({ dev }: { dev: Dev }) {
  return (
    <Link to="/dev/$id" params={{ id: dev.id }} className="font-medium text-foreground hover:text-primary">
      {dev.alias}
    </Link>
  );
}
