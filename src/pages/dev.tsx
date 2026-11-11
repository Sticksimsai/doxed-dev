import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Lock, XCircle } from "@/components/icons";
import { getDevWithTokens } from "@/lib/api";
import { ago, cn, date, deltaClass, pct, short, usd } from "@/lib/format";
import type { Dev } from "@/lib/types";
import { Identicon } from "@/components/icons";
import { CopyButton, DISCLOSURE, GithubIcon, KydBadge, LaunchpadChip, Redacted, SectionCard, TokenIcon, XIcon } from "@/components/ui";

const CHECKS: [keyof Dev["checks"], string, string][] = [
  ["identity", "Government ID", "Photo ID matched to the person"],
  ["liveness", "Liveness", "Real person, present at verification"],
  ["wallet", "Launch wallet", "Signed a message from the deploying wallet"],
  ["x", "X account", "Proved control of the linked X account"],
  ["github", "GitHub", "Proved control of the linked GitHub"],
  ["screening", "Screening", "Passed sanctions and watch-list checks"],
];

export function DevPage() {
  const { id } = useParams({ from: "/dev/$id" });
  const { data, isLoading } = useQuery({ queryKey: ["dev", id], queryFn: () => getDevWithTokens(id) });
  const dev = data?.dev;
  if (isLoading) return <div className="py-20 text-center text-sm text-subtle">Loading…</div>;
  if (!dev) return <div className="py-20 text-center text-sm text-subtle">Dev not found.</div>;
  const tokens = data!.tokens;
  const d = DISCLOSURE[dev.disclosure];

  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Discover
      </Link>

      <header className="card relative overflow-hidden p-5 sm:p-6">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <Identicon seed={dev.alias} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold">{dev.alias}</h1>
              <KydBadge dev={dev} size="md" />
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{dev.revealed.bio ?? d.desc}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
              <CopyButton value={dev.wallet} label={short(dev.wallet, 6, 6)} />
              <span>Verified {date(dev.verifiedAt)}</span>
              {dev.revealed.x && (
                <a href={`https://x.com/${dev.revealed.x}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  <XIcon className="h-3 w-3" /> @{dev.revealed.x}
                </a>
              )}
              {dev.revealed.github && (
                <a href={`https://github.com/${dev.revealed.github}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  <GithubIcon className="h-3 w-3" /> {dev.revealed.github}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="What we verified" className="lg:col-span-2">
          <ul className="grid gap-2 sm:grid-cols-2">
            {CHECKS.map(([k, l, desc]) => (
              <li key={k} className={cn("flex gap-3 rounded-lg border p-3", dev.checks[k] ? "border-primary/20 bg-primary/5" : "border-border opacity-60")}>
                {dev.checks[k] ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />}
                <div>
                  <div className="text-sm font-medium">{l}</div>
                  <div className="text-xs text-muted-foreground">{dev.checks[k] ? desc : "Not provided"}</div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Public details">
          <p className="mb-3 text-xs text-muted-foreground">
            Everything below was checked by us. Greyed bars are details we hold privately that the dev chose not to publish.
          </p>
          <dl className="space-y-2 text-sm">
            {(
              [
                ["Legal name", dev.revealed.name],
                ["Region", dev.revealed.region],
                ["X", dev.revealed.x && `@${dev.revealed.x}`],
                ["GitHub", dev.revealed.github],
                ["LinkedIn", dev.revealed.linkedin],
                ["Date of birth", undefined],
                ["Address", undefined],
              ] as [string, string | undefined][]
            ).map(([l, v]) => (
              <div key={l} className="flex items-center justify-between gap-3">
                <dt className="text-subtle">{l}</dt>
                <dd>{v ?? <Redacted w={l === "Address" ? 120 : 90} />}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Tokens launched", String(dev.stats.launches)],
          ["Locks honoured", `${dev.stats.locksHonored}`],
          ["Locks broken", `${dev.stats.locksBroken}`],
          ["Fees claimed", `${dev.stats.totalFeesClaimedSol.toFixed(1)} SOL`],
        ].map(([l, v]) => (
          <div key={l} className="card p-4">
            <div className="font-mono text-2xl font-medium">{v}</div>
            <div className="text-xs text-subtle">{l}</div>
          </div>
        ))}
      </div>

      <SectionCard title={`Launches (${tokens.length})`}>
        <ul className="divide-y divide-border">
          {tokens.map((t) => (
            <li key={t.mint}>
              <Link to="/token/$mint" params={{ mint: t.mint }} className="flex items-center gap-3 py-3 hover:opacity-90">
                <TokenIcon t={t} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {t.symbol} <span className="text-sm text-subtle">{t.name}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-subtle">
                    <LaunchpadChip id={t.launchpad} /> {ago(t.createdAt)} ago
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3 text-primary" /> until {date(t.lock.unlocksAt)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium tabular">{usd(t.mcap)}</div>
                  <div className={cn("text-xs tabular", deltaClass(t.change["24h"]))}>{pct(t.change["24h"])}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
