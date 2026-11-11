import { Link, Outlet } from "@tanstack/react-router";
import { ArrowUp, BookOpen, ChartNoAxesCombined, Code2, DoxedMark, Rocket, Star } from "@/components/icons";
import { EventTicker } from "./code-fx";
import { useMe, useSignIn, useSignOut } from "@/lib/session";
import { short } from "@/lib/format";

function WalletButton() {
  const { data: me } = useMe();
  const signIn = useSignIn();
  const signOut = useSignOut();
  if (me?.wallet)
    return (
      <button onClick={() => signOut.mutate()} className="btn-ghost !px-3 !py-1.5 text-[13px]" title="Sign out">
        <span className="h-1.5 w-1.5 bg-success" />
        {me.dev?.alias ?? short(me.wallet, 4, 4)}
      </button>
    );
  return (
    <button
      onClick={() => signIn.mutate(undefined, { onError: (e) => alert((e as Error).message) })}
      disabled={signIn.isPending}
      className="btn-ghost !px-3 !py-1.5 text-[13px]"
    >
      {signIn.isPending ? "Signing…" : "Connect"}
    </button>
  );
}
import { useEffect, useState } from "react";
import { APP_NAME, BRAND_BOLD, BRAND_LIGHT, X_URL } from "@/lib/brand";
import { XIcon } from "./ui";

const navBase = "whitespace-nowrap rounded-[4px] px-3 py-1.5 text-[13px] text-muted-foreground transition hover:text-foreground";
const navActive = `${navBase} bg-raised text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]`;

export function Brand({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2.5">
      <span className="flex items-center justify-center rounded-md border border-border-strong bg-card p-1.5"><DoxedMark className={small ? "h-4 w-5" : "h-[18px] w-[22px]"} /></span>
      <span className={`font-display whitespace-nowrap font-semibold ${small ? "text-sm" : "text-base lg:text-lg"}`}>
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
        <span className="absolute inline-flex h-full w-full animate-ping bg-foreground/70 opacity-75" />
        <span className="relative inline-flex h-2 w-2 bg-foreground" />
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
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
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
              <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-1">
                <NavLinks />
              </div>
              <WalletButton />
              <Link
                to="/launch"
                className="btn-primary !py-1.5 text-[13px]"
              >
                <Rocket className="h-3.5 w-3.5" /> Launch
              </Link>
              <a href={X_URL} target="_blank" rel="noreferrer" aria-label="X" className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-raised hover:text-foreground">
                <XIcon className="h-[18px] w-[18px]" />
              </a>
            </nav>
            <span className="lg:hidden">
              <WalletButton />
            </span>
            <a href={X_URL} target="_blank" rel="noreferrer" aria-label="X" className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-raised hover:text-foreground lg:hidden">
              <XIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 py-1.5 lg:hidden [scrollbar-width:none]">
          <NavLinks />
        </nav>
      </div>
      <EventTicker />
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
      <span className="pointer-events-none absolute right-0 bottom-full mb-1.5 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium tip shadow-md">
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
    <div className="min-h-screen text-foreground">
      <div className="backdrop" aria-hidden />
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 pb-24">
        <Outlet />
        <p className="mt-10 text-center font-mono text-[11px] text-subtle">
          {APP_NAME} verifies developers and enforces locks. It does not make any token a safe investment — always do your own research.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
