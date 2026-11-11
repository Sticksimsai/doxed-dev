import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Coins,
  ExternalLink,
  Globe,
  Lock,
  RefreshCw,
  ShieldCheck,
  Droplets,
  TrendingUp,
  Users,
  Zap,
  XCircle,
} from "@/components/icons";
import { useState, type ReactNode } from "react";
import { Cursor, Typewriter } from "@/components/code-fx";
import { devById, getToken, launchpadById } from "@/lib/api";
import { ago, cn, compact, date, deltaClass, int, pct, short, sol, usd } from "@/lib/format";
import type { Dev, Token } from "@/lib/types";
import {
  CopyButton,
  DISCLOSURE,
  GithubIcon,
  KydBadge,
  Kpi,
  KydMark,
  LockProgress,
  PriceChart,
  Redacted,
  SectionCard,
  TokenIcon,
  XIcon,
} from "@/components/ui";

export function TokenPage() {
  const { mint } = useParams({ from: "/token/$mint" });
  const { data: t, isLoading } = useQuery({ queryKey: ["token", mint], queryFn: () => getToken(mint) });

  if (isLoading) return <div className="py-20 text-center text-sm text-muted-foreground">Loading token…</div>;
  if (!t)
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        This token is no longer in the live feed. <Link to="/" className="text-primary">Back to Discover</Link>
      </div>
    );

  const dev = devById(t.devId)!;
  const lp = launchpadById(t.launchpad);
  const claimed = t.feeClaims.reduce((s, c) => s + c.amountSol, 0);
  const lockedUsd = t.lock.amount * (t.mcap / t.totalSupply);
  const monthsLeft = Math.max(0, Math.round((Date.parse(t.lock.unlocksAt) - Date.now()) / (30 * 864e5)));

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to discover
      </Link>

      {/* Header — same structure as EZ Screener */}
      <header className="mt-4 flex flex-wrap items-start gap-4">
        <TokenIcon t={t} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold md:text-4xl">{t.name}</h1>
            <KydMark dev={dev} size={22} />
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">${t.symbol}</span>
            <span className="rounded-[4px] border border-foreground/40 bg-foreground/10 px-1.5 py-0.5 text-xs text-foreground">DOXED · {DISCLOSURE[dev.disclosure].short}</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 bg-current" />
              {lp.name}
            </span>
            {t.stage === "bonding" ? (
              <span className="rounded-[4px] border border-dashed border-border-strong px-1.5 py-0.5 text-xs text-foreground">Bonding {t.bondingPct}%</span>
            ) : (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Graduated · {lp.graduatesTo}</span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <CopyButton value={t.mint} label={short(t.mint, 6, 6)} />
            <span>•</span>
            <span>Launched {ago(t.createdAt)} ago</span>
            {t.taxPct != null && (
              <>
                <span>•</span>
                <span className="text-foreground">Tax {t.taxPct}%</span>
              </>
            )}
            <span>•</span>
            <span>
              Dev{" "}
              <Link to="/dev/$id" params={{ id: dev.id }} className="text-foreground hover:text-primary">
                {dev.alias}
              </Link>
            </span>
            {t.links.x && (
              <>
                <span>•</span>
                <a href={t.links.x} target="_blank" rel="noreferrer" className="hover:text-foreground">Twitter ↗</a>
              </>
            )}
            {t.links.website && (
              <>
                <span>•</span>
                <a href={t.links.website} target="_blank" rel="noreferrer" className="hover:text-foreground">Website ↗</a>
              </>
            )}
            {t.links.github && (
              <>
                <span>•</span>
                <a href={t.links.github} target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub ↗</a>
              </>
            )}
          </div>
        </div>
        <a
          href={t.launchpad === "pumpfun" ? `https://pump.fun/coin/${t.mint}` : `https://jup.ag/swap/SOL-${t.mint}`}
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
        >
          {t.launchpad === "pumpfun" ? `Trade on ${lp.name}` : "Trade"} ↗
        </a>
      </header>

      {/* KPI bento */}
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi className="sm:col-span-2" size="lg" icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Market cap" value={usd(t.mcap)} sub={<span className={deltaClass(t.change["24h"])}>{pct(t.change["24h"])} 24h</span>} />
        <Kpi icon={<Droplets className="h-4 w-4" />} label="Liquidity" value={usd(t.liquidity)} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Holders" value={int(t.holders)} />
        <a href="#dev" className="contents">
          <Kpi variant="cyber" icon={<ShieldCheck className="h-5 w-5" />} label="Dev doxed" value={DISCLOSURE[dev.disclosure].short} sub={`checked ${ago(dev.verifiedAt)} ago`} />
        </a>
        <a href="#fees" className="contents">
          <Kpi variant="cyber" icon={<Coins className="h-5 w-5" />} label="Fees claimed" value={`${claimed.toFixed(2)} SOL`} sub={`${t.feeClaims.length} claims`} />
        </a>
        <a href="#lock" className="contents">
          <Kpi
            variant="cyber"
            size="lg"
            className="sm:col-span-2"
            icon={<Lock className="h-5 w-5" />}
            label="Dev tokens locked"
            value="100%"
            sub={`${usd(lockedUsd)} · unlocks ${date(t.lock.unlocksAt)} (${monthsLeft} mo)`}
          />
        </a>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <AiSummaryCard t={t} />
          <RepoCard t={t} />
          <MarketCard t={t} />
        </div>
        <aside className="space-y-6">
          <DevCard dev={dev} />
          <LockCard t={t} />
          <FeesCard t={t} claimed={claimed} />
          <SafetyCard t={t} />
        </aside>
      </div>
    </div>
  );
}

function MarketCard({ t }: { t: Token }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price chart</h2>
        <span className="font-mono text-[11px] text-subtle">7d · live</span>
      </div>
      <div className="bg-background px-1 pt-2">
        <PriceChart data={t.series} up={t.change["24h"] >= 0} />
      </div>
      <div className="grid grid-cols-4 gap-3 border-t border-border p-4">
        {(["5m", "1h", "6h", "24h"] as const).map((k) => (
          <div key={k} className="rounded-md border border-border bg-background/40 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
            <div className={cn("mt-1 text-base font-semibold tabular", deltaClass(t.change[k]))}>{pct(t.change[k])}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-x-6 border-t border-border px-4 py-2 text-sm sm:grid-cols-2">
        <Row label="24h volume" value={usd(t.volume24h)} />
        <Row label="Liquidity" value={usd(t.liquidity)} />
        <Row label="Total supply" value={int(t.totalSupply)} />
        <Row label="Top 10 holders" value={`${t.topHoldersPct}%`} />
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular">{value}</span>
    </div>
  );
}

function AiSummaryCard({ t }: { t: Token }) {
  const { ai } = t;
  if (!ai)
    return (
      <SectionCard title="AI live summary" subtitle="What this project is, read from its X, website and GitHub" icon={<Zap />}>
        <div className="font-mono text-[13px] text-muted-foreground">
          <span className="text-subtle">$ </span>doxed summarise {t.symbol.toLowerCase()} — reading sources
          <Cursor />
        </div>
        <p className="font-prose mt-2 text-xs text-subtle">The first summary appears a few minutes after launch, then refreshes regularly.</p>
      </SectionCard>
    );
  return (
    <SectionCard
      title="AI live summary"
      subtitle="What this project is, read from its X, website and GitHub"
      icon={<Zap />}
      right={
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <RefreshCw className="h-3 w-3" /> {ago(ai.updatedAt)} ago
        </span>
      }
    >
      <p className="font-prose text-[15px] leading-relaxed">
        <Typewriter text={ai.tldr} />
      </p>
      <ul className="mt-4 space-y-2">
        {ai.points.map((p) => (
          <li key={p} className="font-prose flex gap-2.5 text-sm text-muted-foreground">
            <span className="mt-[3px] font-mono text-[11px] text-subtle">→</span>
            {p}
          </li>
        ))}
      </ul>

      {ai.recent.length > 0 && (
        <div className="mt-5">
          <div className="eyebrow mb-2">Recent activity</div>
          <ol className="relative space-y-3 border-l border-border-strong pl-4">
            {ai.recent.map((r) => (
              <li key={r.text} className="text-sm">
                <span className="absolute -left-[4.5px] mt-1.5 h-2 w-2 bg-foreground" />
                <span className="text-muted-foreground">{r.text}</span>
                <span className="ml-2 text-[11px] text-subtle">{ago(r.at)} ago</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {ai.watchouts.length > 0 && (
        <div className="mt-5 rounded-md border border-dashed border-border-strong p-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-pixel text-[10px] uppercase text-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Worth knowing
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {ai.watchouts.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-border pt-3 text-[11px] text-subtle">
        Sources:
        {ai.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="chip border-border-strong text-muted-foreground hover:text-foreground">
            {s.kind === "x" ? <XIcon className="h-3 w-3" /> : s.kind === "github" ? <GithubIcon className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {s.label}
          </a>
        ))}
        <span className="ml-auto">AI-generated, can be wrong. Not financial advice.</span>
      </div>
    </SectionCard>
  );
}


function RepoCard({ t }: { t: Token }) {
  const r = t.repo;
  if (!r)
    return (
      <SectionCard id="code" title="GitHub due diligence" subtitle="AI review of the linked repository" icon={<GithubIcon />} className="scroll-mt-20">
        <p className="text-sm text-muted-foreground">
          No GitHub repository is linked to this token, so there is no code to review. That's normal for memes — for anything
          claiming to be a product, ask the team where the code is.
        </p>
      </SectionCard>
    );
  const scoreC = "var(--foreground)";
  return (
    <SectionCard
      id="code"
      className="scroll-mt-20"
      title="GitHub due diligence"
      subtitle="AI review of the linked repository"
      icon={<GithubIcon />}
      right={<span className="text-[11px] text-subtle">AI analysis · {ago(r.updatedAt)} ago</span>}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--muted)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke={scoreC} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(r.score / 100) * 97.4} 97.4`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-medium">{r.score}</span>
            <span className="text-[10px] text-subtle">/ 100</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <a href={`https://github.com/${r.repo}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm text-foreground underline decoration-dotted underline-offset-4">
            {r.repo} <ExternalLink className="h-3 w-3" />
          </a>
          <p className="mt-1 text-sm text-muted-foreground">{r.verdict}</p>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <Mini label="Stars" value={int(r.stars)} />
            <Mini label="Contributors" value={int(r.contributors)} />
            <Mini label="Commits (30d)" value={int(r.commits30d)} />
            <Mini label="Last commit" value={`${ago(r.lastCommit)} ago`} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex h-2 overflow-hidden rounded-[4px]">
        {r.languages.map((l, i) => (
          <div key={l.name} style={{ width: `${l.pct}%`, background: `rgb(255 255 255 / ${0.85 - i * 0.3})` }} title={`${l.name} ${l.pct}%`} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-subtle">
        {r.languages.map((l, i) => (
          <span key={l.name} className="flex items-center gap-1">
            <span className="h-2 w-2" style={{ background: `rgb(255 255 255 / ${0.85 - i * 0.3})` }} />
            {l.name} {l.pct}%
          </span>
        ))}
      </div>

      <div className="scanline mt-4 rounded-md border border-border bg-black/50 p-3 font-mono text-[12.5px] leading-relaxed">
        <div className="text-subtle">$ doxed scan {r.repo}</div>
        {r.findings.map((f) => (
          <div key={f.label} className="mt-1.5">
            <span className={cn("mr-2", f.status === "good" ? "text-success" : f.status === "warn" ? "text-foreground" : "text-danger")}>
              [{f.status === "good" ? "PASS" : f.status === "warn" ? "WARN" : "FAIL"}]
            </span>
            <span className="text-foreground">{f.label}</span>
            <div className="font-prose pl-[3.4rem] text-muted-foreground">{f.detail}</div>
          </div>
        ))}
        <div className="mt-2 text-subtle">
          score: <span className="text-foreground">{r.score}/100</span>
          <Cursor />
        </div>
      </div>
    </SectionCard>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-subtle">{label}</div>
      <div className="font-medium tabular">{value}</div>
    </div>
  );
}

function DevCard({ dev }: { dev: Dev }) {
  const d = DISCLOSURE[dev.disclosure];
  const checks: [keyof Dev["checks"], string][] = [
    ["identity", "Government ID"],
    ["liveness", "Liveness check"],
    ["wallet", "Owns launch wallet"],
    ["x", "Owns X account"],
    ["github", "Owns GitHub"],
    ["screening", "Sanctions screening"],
  ];
  return (
    <SectionCard id="dev" className="scroll-mt-20" title="Doxed dev" subtitle="Identity verified privately by us" icon={<BadgeCheck />}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link to="/dev/$id" params={{ id: dev.id }} className="font-display text-lg font-semibold hover:text-primary">
            {dev.alias}
          </Link>
          <div className="font-mono text-[11px] text-subtle">{short(dev.wallet, 6, 6)}</div>
        </div>
        <KydBadge dev={dev} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{d.desc}</p>

      <dl className="mt-3 space-y-1.5 text-sm">
        <Field label="Name" value={dev.revealed.name} />
        <Field label="Region" value={dev.revealed.region} />
        <Field label="X" value={dev.revealed.x && `@${dev.revealed.x}`} />
        <Field label="GitHub" value={dev.revealed.github} />
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3">
        {checks.map(([k, l]) => (
          <div key={k} className={cn("flex items-center gap-1.5 text-xs", dev.checks[k] ? "text-muted-foreground" : "text-subtle line-through")}>
            {dev.checks[k] ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-subtle" />}
            {l}
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Box label="Launches" value={String(dev.stats.launches)} />
        <Box label="Locks kept" value={`${dev.stats.locksHonored}/${dev.stats.locksHonored + dev.stats.locksBroken}`} />
        <Box label="Fees claimed" value={`${Math.round(dev.stats.totalFeesClaimedSol)} SOL`} />
      </div>
      <Link to="/dev/$id" params={{ id: dev.id }} className="btn-ghost mt-4 w-full !py-1.5 text-xs">
        View dev profile
      </Link>
    </SectionCard>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-right">{value ? value : <Redacted w={88} />}</dd>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-black/30 px-2 py-2">
      <div className="font-mono text-sm font-medium">{value}</div>
      <div className="font-pixel text-[9px] uppercase text-subtle">{label}</div>
    </div>
  );
}

function LockCard({ t }: { t: Token }) {
  const l = t.lock;
  return (
    <SectionCard
      id="lock"
      className="scroll-mt-20"
      title="Dev lock"
      subtitle="On-chain, non-cancellable"
      icon={<Lock />}
      right={<span className="chip border-foreground/40 font-pixel text-[9px] uppercase text-foreground">● Active</span>}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-3xl font-medium tracking-tight">100%</span>
        <span className="text-xs text-subtle">of dev allocation</span>
      </div>
      <div className="mt-1 text-sm text-muted-foreground">
        {compact(l.amount)} {t.symbol} · {l.pctOfSupply}% of supply · {usd(l.amount * (t.mcap / t.totalSupply))} today
      </div>
      <div className="mt-4">
        <LockProgress startsAt={l.startsAt} unlocksAt={l.unlocksAt} />
      </div>
      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-subtle">Locked on</dt>
          <dd>{date(l.startsAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-subtle">Unlocks</dt>
          <dd className="font-medium">{date(l.unlocksAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-subtle">Term</dt>
          <dd>{l.termMonths} months</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-subtle">Contract</dt>
          <dd>
            <a href={`https://solscan.io/account/${l.contract}`} target="_blank" rel="noreferrer" title="Verify the lock on-chain" className="inline-flex items-center gap-1 font-mono text-xs text-foreground underline decoration-dotted underline-offset-4">
              {short(l.contract)} <ExternalLink className="h-3 w-3" />
            </a>
          </dd>
        </div>
      </dl>
    </SectionCard>
  );
}

function FeesCard({ t, claimed }: { t: Token; claimed: number }) {
  const [open, setOpen] = useState(false);
  const list = open ? t.feeClaims : t.feeClaims.slice(0, 4);
  const max = Math.max(...t.feeClaims.map((c) => c.amountSol), 1);
  return (
    <SectionCard id="fees" className="scroll-mt-20" title="Dev claim fees" subtitle="On-chain creator fee claims" icon={<Coins />}>
      <div className={cn("grid gap-2", t.taxPct != null || t.feesUnclaimedSol != null ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        <Box label="Claimed total" value={sol(claimed)} />
        <Box label="Claims" value={String(t.feeClaims.length)} />
        {t.taxPct != null && <Box label="Trading tax" value={`${t.taxPct}%`} />}
        {t.feesUnclaimedSol != null && <Box label="Unclaimed" value={sol(t.feesUnclaimedSol)} />}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Trading fees the dev has withdrawn. Claiming fees is normal — sudden large claims right before a dump are worth noticing.
      </p>
      {t.feeClaims.length === 0 ? (
        <div className="mt-3 text-sm text-subtle">No claims yet.</div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {list.map((c) => (
            <li key={c.signature} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 text-xs text-subtle">{ago(c.at)}</span>
              <div className="h-1.5 flex-1 overflow-hidden bg-white/10">
                <div className="h-full bg-foreground/70" style={{ width: `${(c.amountSol / max) * 100}%` }} />
              </div>
              <a href={`https://solscan.io/tx/${c.signature}`} target="_blank" rel="noreferrer" className="w-20 shrink-0 text-right font-medium tabular hover:text-primary">
                {c.amountSol.toFixed(2)} SOL
              </a>
            </li>
          ))}
        </ul>
      )}
      {t.feeClaims.length > 4 && (
        <button onClick={() => setOpen((o) => !o)} className="mt-3 inline-flex items-center gap-1 text-xs text-subtle hover:text-foreground">
          {open ? "Show less" : `Show all ${t.feeClaims.length}`} <ChevronDown className={cn("h-3 w-3 transition", open && "rotate-180")} />
        </button>
      )}
    </SectionCard>
  );
}

function SafetyCard({ t }: { t: Token }) {
  const rows: [boolean, string][] = [
    [t.mintAuthorityOff, "Mint authority disabled — no new tokens can be created"],
    [t.freezeAuthorityOff, "Freeze authority disabled — wallets can't be frozen"],
    [t.topHoldersPct < 35, `Top 10 holders own ${t.topHoldersPct}%`],
  ];
  return (
    <SectionCard title="Audit" subtitle="Token authorities and distribution" icon={<ShieldCheck />}>
      <ul className="space-y-2">
        {rows.map(([ok, l]) => (
          <li key={l} className="flex gap-2 text-sm text-muted-foreground">
            {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
            {l}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
