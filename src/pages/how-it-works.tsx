import { Link } from "@tanstack/react-router";
import { ChevronDown, Code2, Coins, EyeOff, Layers, Lock, Rocket, ShieldCheck, Sparkles } from "@/components/icons";
import { APP_NAME, LOCK_MIN_MONTHS } from "@/lib/brand";
import { LAUNCHPADS } from "@/lib/mock";

const PILLARS = [
  {
    icon: Layers,
    title: "Launch anywhere",
    body: "Pick Pump.fun or Meteora — on Meteora you set your own trading tax. Your token is native to that launchpad; we sit on top.",
  },
  {
    icon: ShieldCheck,
    title: "Doxed, privately",
    body: "Every dev proves who they are to us before launching. Holders see the Doxed badge; the personal details stay private.",
  },
  {
    icon: Lock,
    title: `100% locked, ${LOCK_MIN_MONTHS}+ months`,
    body: "Every token the dev holds at launch is locked in a non-cancellable on-chain contract. The contract is public and linked on every token page.",
  },
  {
    icon: Sparkles,
    title: "AI research, always fresh",
    body: "Each token gets a plain-English summary built from its X and website, plus a code review when a GitHub is linked.",
  },
  {
    icon: Coins,
    title: "Fee claim history",
    body: "Every creator-fee withdrawal is listed with its transaction, so you can see how and when the dev takes revenue.",
  },
  {
    icon: Code2,
    title: "Builder API",
    body: "Doxed devs get their own API keys to hundreds of AI models through one OpenAI-compatible endpoint, with up to $100 of free compute a month.",
  },
  {
    icon: EyeOff,
    title: "Privacy by default",
    body: "Devs choose what to reveal: badge only, linked socials, or their real name. They can reveal more later, never less.",
  },
];

const FAQ = [
  {
    q: "Who can see a dev's identity documents?",
    a: `The ID and face scans are handled by our secure verification partner and never stored on ${APP_NAME}'s servers. We keep only the result, the dev's name and date of birth privately, and a one-way fingerprint of the ID number so the same ID can't be used twice. Holders only ever see the badge and what the dev chooses to reveal.`,
  },
  {
    q: "How do you catch fake IDs?",
    a: "Every scan runs document-authenticity checks (tampering, templates, screen and print replays), a liveness check that catches photos, masks and deepfakes, and a face match between the selfie and the ID photo. An AI risk check then reviews all the signals together and sends anything unusual to a human.",
  },
  {
    q: "What happens if a dev breaks the rules?",
    a: "Their profile is publicly flagged on every token they launched and they can't launch with us again. Identity details are only released where the law requires it, for example to law enforcement with a valid request.",
  },
  {
    q: "Does verification mean a token is safe to buy?",
    a: "No. It means a real, accountable person is behind it and their own tokens can't be dumped for at least 12 months. Price can still go to zero — always research before buying.",
  },
  {
    q: "What exactly is locked?",
    a: `100% of the tokens in the dev's launch wallet after the dev buy, for at least ${LOCK_MIN_MONTHS} months. Tokens bought by the public on the curve are not locked.`,
  },
  {
    q: "How often is the AI summary updated?",
    a: "Several times a day and whenever the project posts something new on X or changes its website. The timestamp on each summary shows when it last ran.",
  },
];

export function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="text-center">
        <span className="chip border-border-strong bg-card text-foreground">How {APP_NAME} works</span>
        <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">Trust layer for Solana launchpads</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          We don't replace your favourite launchpad. We add the two things memecoins are missing: an accountable dev and a dev
          bag that can't be dumped.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="card p-5">
            <span className="inline-flex rounded-md border border-border-strong p-2"><p.icon className="h-4 w-4" /></span>
            <h3 className="mt-3 font-display text-lg font-medium">{p.title}</h3>
            <p className="font-prose mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="eyebrow">For holders</div>
          <ol className="mt-3 space-y-3 text-sm">
            {[
              "Browse Discover — every token listed has a verified dev.",
              "Open a token: check the trust strip at the top (dev, lock, fees, code).",
              "Read the AI summary and watch-outs, then decide.",
            ].map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-raised text-xs font-semibold">{i + 1}</span>
                <span className="text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card p-5">
          <div className="eyebrow">For devs</div>
          <ol className="mt-3 space-y-3 text-sm">
            {[
              "Scan your ID and face once (about 2 minutes) and pick what to make public.",
              "Choose a launchpad and fill in your token details.",
              `Hit launch and approve twice — we create the token and lock your bag for ${LOCK_MIN_MONTHS}+ months.`,
            ].map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-raised text-xs font-semibold">{i + 1}</span>
                <span className="text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>
          <Link to="/launch" className="btn-primary mt-5 w-full">
            <Rocket className="h-4 w-4" /> Start a launch
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Supported launchpads</h2>
        <div className="flex flex-wrap gap-2">
          {LAUNCHPADS.map((l) => (
            <span key={l.id} className="chip border-border-strong px-3 py-1.5 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-[4px]"  />
              {l.name}
              {!l.available && <span className="text-subtle">· soon</span>}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Questions</h2>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-subtle transition group-open:rotate-180" />
              </summary>
              <p className="font-prose mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
