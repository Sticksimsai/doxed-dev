import { Link, Outlet } from "@tanstack/react-router";
import { ArrowUp, BookOpen, ChartNoAxesCombined, Code2, Rocket, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { BRAND_BOLD, BRAND_LIGHT, X_URL } from "@/lib/brand";
import { XIcon } from "./ui";

const navBase = "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition hover:text-foreground";
const navActive = `${navBase} bg-raised text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]`;

/** Logo: a notched seal with a check — the "vouched for" stamp. */
export function SealMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="seal-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.9 0.12 85)" />
          <stop offset="1" stopColor="oklch(0.72 0.16 60)" />
        </linearGradient>
      </defs>
      <path
        fill="url(#seal-g)"
        d="M16 1.5l3.1 2.6 4-.5 1.6 3.7 3.7 1.6-.5 4 2.6 3.1-2.6 3.1.5 4-3.7 1.6-1.6 3.7-4-.5L16 30.5l-3.1-2.6-4 .5-1.6-3.7-3.7-1.6.5-4L1.5 16l2.6-3.1-.5-4 3.7-1.6 1.6-3.7 4 .5z"
      />
      <path d="M10.5 16.4l3.6 3.6 7.4-7.6" fill="none" stroke="oklch(0.18 0.03 70)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2.5">
      <SealMark className={small ? "h-7 w-7" : "h-8 w-8"} />
      <span className={`font-display whitespace-nowrap font-bold tracking-tight ${small ? "text-xs sm:text-sm" : "text-sm lg:text-[17px]"}`}>
        {BRAND_BOLD} <span className="font-normal text-muted-foreground">{BRAND_LIGHT}</span>
      </span>
    </Link>
  );
}

/** Platform token market-cap pill (same look as EZ Screener's LiveMcap). */
function LiveMcap() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 py-1 font-mono text-[11px] tabular shadow-sm sm:px-2.5 sm:py-1.5 sm:text-xs"
      title="Platform token market cap (live once launched)"
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px]">MC</span>
      <span className="font-semibold text-muted-foreground">…</span>
      <ArrowUp className="h-3 w-3 text-muted-foreground opacity-40" />
    </span>
  );
}

function LiveViewers() {
  const [n, setN] = useState(37);
  useEffect(() => {
    const id = setInterval(() => setN((v) => Math.max(5, v + Math.round((Math.random() - 0.5) * 4))), 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/80 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="tabular">{n} viewing</span>
    </div>
  );
}

function NavLinks() {
  return (
    <>
      <Link to="/" className={navBase} activeOptions={{ exact: true }} activeProps={{ className: navActive }}>
        Discover
      </Link>
      <Link to="/launch" className={navBase} activeProps={{ className: navActive }}>
        Launch
      </Link>
      <Link to="/how-it-works" className={navBase} activeProps={{ className: navActive }}>
        How it works
      </Link>
    </>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/75 backdrop-blur-xl">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-4">
        <div className="flex h-14 items-center gap-2.5 lg:h-16 lg:gap-3">
          <Brand />
          <span className="hidden h-6 w-px bg-border lg:block" aria-hidden />
          <LiveMcap />
          <div className="ml-auto flex items-center gap-2 lg:gap-4">
            <span className="hidden sm:block">
              <LiveViewers />
            </span>
            <nav className="hidden items-center gap-2 lg:flex">
              <div className="flex items-center gap-0.5 rounded-full border border-border bg-card/60 p-1">
                <NavLinks />
              </div>
              <Link
                to="/launch"
                className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_-6px_var(--primary)] transition hover:brightness-110"
              >
                <Rocket className="h-3.5 w-3.5" /> Launch token
              </Link>
              <a href={X_URL} target="_blank" rel="noreferrer" aria-label="X" className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-raised hover:text-foreground">
                <XIcon className="h-[18px] w-[18px]" />
              </a>
            </nav>
            <a href={X_URL} target="_blank" rel="noreferrer" aria-label="X" className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-raised hover:text-foreground lg:hidden">
              <XIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 py-1.5 lg:hidden [scrollbar-width:none]">
          <NavLinks />
        </nav>
      </div>
    </header>
  );
}

function DockButton({ label, icon: Icon, to, soon }: { label: string; icon: typeof Star; to?: string; soon?: boolean }) {
  const cls = "inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground";
  return (
    <div className="group relative">
      {to && !soon ? (
        <Link to={to} aria-label={label} className={cls}>
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </Link>
      ) : (
        <button type="button" disabled aria-label={`${label} (coming soon)`} className={`${cls} cursor-not-allowed opacity-50 hover:bg-transparent`}>
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </button>
      )}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {label}
        {soon ? " · coming soon" : ""}
      </span>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="fixed right-0 bottom-0 left-0 z-40 border-t border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-3 px-3 sm:h-14 sm:px-4">
        <Brand small />
        <div className="flex items-center gap-1 sm:gap-2">
          <DockButton label="Discover" icon={ChartNoAxesCombined} to="/" />
          <DockButton label="Watchlist" icon={Star} soon />
          <DockButton label="Launch a token" icon={Rocket} to="/launch" />
          <DockButton label="How it works" icon={BookOpen} to="/how-it-works" />
          <DockButton label="Public API" icon={Code2} soon />
          <a href={X_URL} target="_blank" rel="noreferrer" aria-label="X" className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-raised hover:text-foreground">
            <XIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 pb-24">
        <Outlet />
        <p className="mt-10 text-center text-[11px] text-muted-foreground/70">
          {BRAND_BOLD} verifies developers and enforces locks. It does not make any token a safe investment — always do your own research.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
