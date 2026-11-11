import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowDown, ArrowRight, ArrowUp, BarChart3, ChevronsUpDown, Coins, ExternalLink, Lock } from "@/components/icons";
import { Cursor, Scramble, TerminalDemo } from "@/components/code-fx";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { devById, launchpadById, listTokens } from "@/lib/api";
import { LAUNCHPADS } from "@/lib/mock";
import { LOCK_MIN_MONTHS, PLATFORM_CA } from "@/lib/brand";
import { ago, cn, deltaClass, int, pct, usd } from "@/lib/format";
import type { Disclosure, LaunchpadId, Token } from "@/lib/types";
import { CaButton, FilterSelect, KydMark, LaunchpadChip, Sparkline, StatCard, TokenIcon, TokenQuickLinks } from "@/components/ui";

type TF = "5m" | "1h" | "6h" | "24h";
type SortKey = "mcap" | "change" | "volume24h" | "liquidity" | "holders" | "locked" | "age";

const DISCLOSURE_RANK: Record<Disclosure, number> = { private: 0, pseudonymous: 1, public: 2 };

export function DiscoverPage() {
  const { data: tokens = [], isLoading, dataUpdatedAt } = useQuery({ queryKey: ["tokens"], queryFn: listTokens, refetchInterval: 10_000 });
  const [q, setQ] = useState("");
  const [tf, setTf] = useState<TF>("24h");
  const [pad, setPad] = useState<LaunchpadId | "all">("all");
  const [dev, setDev] = useState<number>(0);
  const [minVol, setMinVol] = useState(0);
  const [minMcap, setMinMcap] = useState(0);
  const [sort, setSort] = useState<SortKey>("mcap");
  const [dir, setDir] = useState<1 | -1>(-1);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const val = (t: Token): number =>
      sort === "change"
        ? t.change[tf]
        : sort === "age"
          ? Date.parse(t.createdAt)
          : sort === "locked"
            ? Date.parse(t.lock.unlocksAt)
            : (t[sort] as number);
    return tokens
      .filter((t) => !s || t.name.toLowerCase().includes(s) || t.symbol.toLowerCase().includes(s) || t.mint.toLowerCase().includes(s))
      .filter((t) => pad === "all" || t.launchpad === pad)
      .filter((t) => DISCLOSURE_RANK[devById(t.devId)!.disclosure] >= dev)
      .filter((t) => t.volume24h >= minVol && t.mcap >= minMcap)
      .sort((a, b) => (val(a) - val(b)) * dir);
  }, [tokens, q, pad, dev, minVol, minMcap, sort, dir, tf]);

  const totals = useMemo(
    () => ({
      mcap: tokens.reduce((s, t) => s + t.mcap, 0),
      vol: tokens.reduce((s, t) => s + t.volume24h, 0),
      locked: tokens.reduce((s, t) => s + t.lock.amount * (t.mcap / t.totalSupply), 0),
    }),
    [tokens],
  );

  const toggle = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(k);
      setDir(-1);
    }
  };
  const icon = (k: SortKey) =>
    sort !== k ? (
      <ChevronsUpDown className="inline-block h-3.5 w-3.5 text-muted-foreground/50" />
    ) : dir === -1 ? (
      <ArrowDown className="inline-block h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowUp className="inline-block h-3.5 w-3.5 text-primary" />
    );

  return (
    <>
      {/* Hero */}
      <section className="relative mb-8 overflow-hidden rounded-xl border border-border bg-card px-5 py-8 md:px-10 md:py-12">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(80%_90%_at_80%_10%,black,transparent)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 rounded-[4px] border border-border-strong bg-card px-2 py-1 font-pixel text-[10px] uppercase text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping bg-foreground/70" />
                <span className="relative inline-flex h-1.5 w-1.5 bg-foreground" />
              </span>
              Live on Solana
            </div>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] font-semibold md:text-6xl">
              <Scramble text="Every dev doxed." />
              <span className="block text-muted-foreground">
                <Scramble text="Every bag locked." delay={350} />
                <Cursor className="text-foreground" />
              </span>
            </h1>
            <p className="font-prose mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Launch on Pump.fun or Meteora. Devs prove who they are to us privately, and 100% of their
              tokens are locked for {LOCK_MIN_MONTHS}+ months. You get the proof. They keep their privacy.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link to="/launch" className="btn-primary">
                Launch a token <ArrowRight className="h-3 w-3" />
              </Link>
              <Link to="/how-it-works" className="btn-ghost">
                How it works
              </Link>
              <CaButton value={PLATFORM_CA} />
            </div>
          </div>
          <TerminalDemo className="fade-up [animation-delay:150ms]" />
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Activity} label="Doxed tokens" value={`${rows.length}/${tokens.length}`} />
          <StatCard icon={Coins} label="Total mcap" value={usd(totals.mcap)} accent />
          <StatCard icon={BarChart3} label="24h volume" value={usd(totals.vol)} />
          <StatCard icon={Lock} label="Dev bags locked" value={usd(totals.locked)} />
        </div>
      </section>

      {/* Trending */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-medium">Trending</h2>
          <span className="font-mono text-[11px] text-subtle">sort: 24h_change desc</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[...tokens]
            .sort((a, b) => b.change["24h"] - a.change["24h"])
            .slice(0, 3)
            .map((t, i) => (
              <TrendCard key={t.mint} t={t} rank={i + 1} />
            ))}
        </div>
      </section>

      {/* Filter bar */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="> search name, symbol or CA"
          className="col-span-2 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] sm:w-64 lg:w-72 outline-none placeholder:text-subtle focus:border-foreground/50"
        />
        <FilterSelect
          label="Launchpad"
          value={pad}
          onChange={setPad}
          options={[{ label: "All", value: "all" as const }, ...LAUNCHPADS.filter((l) => l.available).map((l) => ({ label: l.name, value: l.id }))]}
        />
        <FilterSelect
          label="Dev"
          value={dev}
          onChange={setDev}
          options={[
            { label: "Any doxed", value: 0 },
            { label: "Socials linked", value: 1 },
            { label: "Fully public", value: 2 },
          ]}
        />
        <FilterSelect
          label="Min vol"
          value={minVol}
          onChange={setMinVol}
          options={[
            { label: "Any", value: 0 },
            { label: "$1k+", value: 1_000 },
            { label: "$10k+", value: 10_000 },
            { label: "$100k+", value: 100_000 },
          ]}
        />
        <FilterSelect
          label="Min mcap"
          value={minMcap}
          onChange={setMinMcap}
          options={[
            { label: "Any", value: 0 },
            { label: "$10k+", value: 10_000 },
            { label: "$100k+", value: 100_000 },
            { label: "$1M+", value: 1_000_000 },
          ]}
        />
        <div className="col-span-2 flex items-center justify-between gap-2 sm:ml-auto sm:justify-end">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
            {(["5m", "1h", "6h", "24h"] as TF[]).map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={cn("rounded-[4px] px-3 py-1 font-medium transition", tf === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {t}
              </button>
            ))}
          </div>
          <UpdatedAgo at={dataUpdatedAt} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] font-pixel text-[10px] uppercase text-subtle">
              <tr>
                <Th className="hidden w-10 text-left sm:table-cell">#</Th>
                <Th className="w-full text-left sm:w-auto">Token</Th>
                <Th onClick={() => toggle("mcap")}>Market cap {icon("mcap")}</Th>
                <Th onClick={() => toggle("change")} className="hidden sm:table-cell">
                  {tf} % {icon("change")}
                </Th>
                <Th onClick={() => toggle("volume24h")} className="hidden xl:table-cell">
                  Vol 24h {icon("volume24h")}
                </Th>
                <Th onClick={() => toggle("liquidity")} className="hidden 2xl:table-cell">
                  Liquidity {icon("liquidity")}
                </Th>
                <Th onClick={() => toggle("holders")} className="hidden lg:table-cell">
                  Holders {icon("holders")}
                </Th>
                <Th onClick={() => toggle("locked")} className="hidden md:table-cell">
                  Locked {icon("locked")}
                </Th>
                <Th onClick={() => toggle("age")} className="hidden lg:table-cell">
                  Age {icon("age")}
                </Th>
                <Th className="hidden xl:table-cell">Trade</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <Row key={t.mint} t={t} i={i} tf={tf} />
              ))}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    No tokens match those filters.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    Fetching token data…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function UpdatedAgo({ at }: { at: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!at) return null;
  return <span className="hidden text-xs text-muted-foreground tabular sm:inline">updated {Math.max(0, Math.round((Date.now() - at) / 1000))}s ago</span>;
}

function Th({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "border-b border-border px-3 py-3 text-right font-medium whitespace-nowrap",
        onClick && "cursor-pointer select-none hover:text-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Row({ t, i, tf }: { t: Token; i: number; tf: TF }) {
  const nav = useNavigate();
  const dev = devById(t.devId)!;
  const lp = launchpadById(t.launchpad);
  const ch = t.change[tf];
  const monthsLeft = Math.max(0, Math.round((Date.parse(t.lock.unlocksAt) - Date.now()) / (30 * 864e5)));
  return (
    <tr onClick={() => nav({ to: "/token/$mint", params: { mint: t.mint } })} className="group cursor-pointer border-t border-border transition hover:bg-raised/40">
      <td className="hidden px-3 py-3 text-muted-foreground tabular sm:table-cell">{i + 1}</td>
      <td className="max-w-0 px-3 py-3 sm:max-w-none">
        <div className="flex flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-3">
            <TokenIcon t={t} size={36} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 whitespace-nowrap font-medium">
                <span className="truncate">{t.symbol}</span>
                <KydMark dev={dev} />
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {t.name}
                {t.stage === "bonding" && <span className="ml-1.5 text-warning">· curve {t.bondingPct}%</span>}
              </div>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="hidden pl-[3.25rem] sm:block">
            <TokenQuickLinks t={t} />
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular">
        {usd(t.mcap)}
        <div className={cn("text-xs sm:hidden", deltaClass(ch))}>{pct(ch)}</div>
      </td>
      <td className={cn("hidden px-3 py-3 text-right font-medium whitespace-nowrap tabular sm:table-cell", deltaClass(ch))}>{pct(ch)}</td>
      <td className="hidden px-3 py-3 text-right tabular xl:table-cell">{usd(t.volume24h)}</td>
      <td className="hidden px-3 py-3 text-right tabular 2xl:table-cell">{usd(t.liquidity)}</td>
      <td className="hidden px-3 py-3 text-right tabular lg:table-cell">{int(t.holders)}</td>
      <td className="hidden px-3 py-3 text-right md:table-cell">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] border border-border-strong px-1.5 py-0.5 text-[11px] text-foreground" title={`100% of dev tokens locked · ${monthsLeft} months left`}>
          <Lock className="h-3 w-3" /> 100% · {monthsLeft}mo
        </span>
      </td>
      <td className="hidden px-3 py-3 text-right text-muted-foreground tabular lg:table-cell">{ago(t.createdAt)}</td>
      <td className="hidden px-3 py-3 text-right xl:table-cell">
        <a
          href="#"
          onClick={(e) => e.stopPropagation()}
          title={`Trade on ${lp.name}`}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border-strong bg-card px-2.5 py-1 text-xs font-medium text-foreground/90 transition hover:border-primary/50 hover:bg-primary/10 hover:text-foreground"
        >
          <span className="h-1.5 w-1.5 bg-current" />
          {lp.name} <ExternalLink className="h-3 w-3" />
        </a>
      </td>
    </tr>
  );
}

function TrendCard({ t, rank }: { t: Token; rank: number }) {
  const dev = devById(t.devId)!;
  return (
    <Link
      to="/token/$mint"
      params={{ mint: t.mint }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-foreground/40"
    >
      <div className="flex items-start gap-3">
        <TokenIcon t={t} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{t.symbol}</span>
            <KydMark dev={dev} />
            <span className="ml-auto font-pixel text-[10px] text-subtle">#{rank}</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">{t.name}</div>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-2xl font-medium tracking-tight">{usd(t.mcap)}</div>
          <div className={cn("text-xs tabular", deltaClass(t.change["24h"]))}>{pct(t.change["24h"])} 24h</div>
        </div>
        <Sparkline data={t.series} up={t.change["24h"] >= 0} className="h-10 w-28" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <LaunchpadChip id={t.launchpad} />
        <span className="chip border-border-strong text-foreground">
          <Lock className="h-3 w-3" /> 100% locked
        </span>
      </div>
    </Link>
  );
}
