// Demo data so every screen works before the backend is wired.
// Replace the functions in ./api.ts — not the components — when going live.
import type { Dev, FeeClaim, Launchpad, Token } from "./types";

export const LAUNCHPADS: Launchpad[] = [
  {
    id: "pumpfun",
    name: "Pump.fun",
    tagline: "Biggest audience, fastest discovery",
    graduatesTo: "PumpSwap",
    bestFor: "Community-first memes that want instant eyeballs",
    color: "oklch(0.8 0.2 148)",
    available: true,
  },
  {
    id: "raydium",
    name: "Raydium LaunchLab",
    tagline: "Custom curves, deep Raydium liquidity",
    graduatesTo: "Raydium AMM",
    bestFor: "Projects that want more control over curve settings",
    color: "oklch(0.72 0.16 285)",
    available: true,
  },
  {
    id: "bonk",
    name: "LetsBonk",
    tagline: "BONK ecosystem reach",
    graduatesTo: "Raydium AMM",
    bestFor: "Tokens leaning into the BONK community",
    color: "oklch(0.8 0.15 70)",
    available: true,
  },
  {
    id: "meteora",
    name: "Meteora DBC",
    tagline: "Dynamic bonding curve, flexible fees",
    graduatesTo: "Meteora DAMM",
    bestFor: "Teams that want fee-sharing and LP flexibility",
    color: "oklch(0.72 0.17 25)",
    available: true,
  },
  {
    id: "float",
    name: "Float",
    tagline: "Coming soon",
    graduatesTo: "—",
    bestFor: "Adapter in progress",
    color: "oklch(0.75 0.12 230)",
    available: false,
  },
];

// ---------- helpers ----------
const NOW = Date.now();
const H = 3_600_000;
const D = 24 * H;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function b58(seed: number, len = 44) {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < len; i++) out += A[Math.floor(r() * A.length)];
  return out;
}

function series(seed: number, trend: number, n = 96) {
  const r = rng(seed);
  const out: number[] = [];
  let v = 1;
  for (let i = 0; i < n; i++) {
    v *= 1 + (r() - 0.5) * 0.09 + trend / n;
    v = Math.max(v, 0.05);
    out.push(v);
  }
  return out;
}

function claims(seed: number, count: number, maxSol: number): FeeClaim[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    signature: b58(seed * 31 + i, 88),
    at: iso((i + 1) * D * (0.6 + r() * 1.6)),
    amountSol: Math.round((0.3 + r() * maxSol) * 100) / 100,
  }));
}

// ---------- devs ----------
export const DEVS: Dev[] = [
  {
    id: "d1",
    alias: "orbitlabs",
    wallet: b58(101),
    disclosure: "public",
    checks: { identity: true, liveness: true, wallet: true, x: true, github: true, screening: true },
    verifiedAt: iso(140 * D),
    revealed: {
      name: "Maya Okafor",
      x: "orbitlabs_sol",
      github: "orbitlabs",
      region: "United Kingdom",
      bio: "Ex-fintech backend engineer. Building agent tooling on Solana since 2023.",
      linkedin: "maya-okafor",
    },
    stats: { launches: 2, locksHonored: 2, locksBroken: 0, totalFeesClaimedSol: 61.4 },
  },
  {
    id: "d2",
    alias: "kitsune.dev",
    wallet: b58(102),
    disclosure: "pseudonymous",
    checks: { identity: true, liveness: true, wallet: true, x: true, github: true, screening: true },
    verifiedAt: iso(60 * D),
    revealed: { x: "kitsune_dev", github: "kitsune-dev", bio: "Indie game dev. Ships fast, posts devlogs weekly." },
    stats: { launches: 1, locksHonored: 1, locksBroken: 0, totalFeesClaimedSol: 18.9 },
  },
  {
    id: "d3",
    alias: "anon-7Q2",
    wallet: b58(103),
    disclosure: "private",
    checks: { identity: true, liveness: true, wallet: true, x: false, github: false, screening: true },
    verifiedAt: iso(9 * D),
    revealed: {},
    stats: { launches: 1, locksHonored: 1, locksBroken: 0, totalFeesClaimedSol: 4.2 },
  },
  {
    id: "d4",
    alias: "harborDAO",
    wallet: b58(104),
    disclosure: "pseudonymous",
    checks: { identity: true, liveness: true, wallet: true, x: true, github: false, screening: true },
    verifiedAt: iso(31 * D),
    revealed: { x: "harbor_dao", region: "Singapore" },
    stats: { launches: 3, locksHonored: 3, locksBroken: 0, totalFeesClaimedSol: 92.7 },
  },
  {
    id: "d5",
    alias: "anon-K9m",
    wallet: b58(105),
    disclosure: "private",
    checks: { identity: true, liveness: true, wallet: true, x: true, github: false, screening: true },
    verifiedAt: iso(3 * D),
    revealed: {},
    stats: { launches: 1, locksHonored: 1, locksBroken: 0, totalFeesClaimedSol: 0.9 },
  },
];

// ---------- tokens ----------
type Seed = {
  name: string;
  symbol: string;
  hue: number;
  launchpad: Token["launchpad"];
  devId: string;
  ageH: number;
  mcap: number;
  graduated: boolean;
  trend: number;
  description: string;
  links: Token["links"];
  ai: Omit<Token["ai"], "updatedAt" | "sources">;
  repo?: Omit<NonNullable<Token["repo"]>, "updatedAt">;
  claimCount: number;
  lockPctSupply: number;
};

const SEEDS: Seed[] = [
  {
    name: "Orbit Agents",
    symbol: "ORBIT",
    hue: 148,
    launchpad: "meteora",
    devId: "d1",
    ageH: 21 * 24,
    mcap: 4_820_000,
    graduated: true,
    trend: 0.9,
    description: "Open-source framework for running autonomous trading agents with on-chain spending limits.",
    links: { x: "https://x.com/orbitlabs_sol", website: "https://orbitagents.xyz", github: "https://github.com/orbitlabs/orbit" },
    ai: {
      tldr: "Orbit is a developer toolkit that lets people run AI trading agents on Solana with hard spending caps enforced by a program, not by trust.",
      points: [
        "Product is live in public beta; the team posts weekly changelogs on X.",
        "Revenue model: a small fee on agent-executed swaps, part of which buys back $ORBIT.",
        "The dev is fully public (name and LinkedIn disclosed) and has one previous launch with its lock honoured.",
      ],
      recent: [
        { at: iso(2 * D), text: "Shipped v0.9 with Jupiter limit-order support (announced on X)." },
        { at: iso(6 * D), text: "Website added a docs section and an agent template gallery." },
        { at: iso(11 * D), text: "Partnership thread with a Solana RPC provider for free agent RPC credits." },
      ],
      watchouts: ["Buyback figures are self-reported on X; no on-chain dashboard yet."],
    },
    repo: {
      repo: "orbitlabs/orbit",
      score: 86,
      verdict: "Active, real codebase with tests. Matches what the team claims on X.",
      stars: 1240,
      contributors: 9,
      commits30d: 147,
      lastCommit: iso(5 * H),
      languages: [
        { name: "Rust", pct: 54 },
        { name: "TypeScript", pct: 41 },
        { name: "Other", pct: 5 },
      ],
      findings: [
        { label: "Original code", status: "good", detail: "No signs of a forked template; history goes back 14 months." },
        { label: "Tests", status: "good", detail: "CI runs on every PR; roughly 70% of program instructions are covered." },
        { label: "Secrets", status: "good", detail: "No keys or private RPC URLs committed." },
        { label: "Program upgradeability", status: "warn", detail: "On-chain program is upgradeable by a single key, not a multisig." },
      ],
    },
    claimCount: 9,
    lockPctSupply: 4.1,
  },
  {
    name: "Pixel Paws",
    symbol: "PAWS",
    hue: 30,
    launchpad: "pumpfun",
    devId: "d2",
    ageH: 7 * 24,
    mcap: 1_240_000,
    graduated: true,
    trend: 0.4,
    description: "A cozy browser pet game where holders adopt and breed pixel cats.",
    links: { x: "https://x.com/pixelpaws_game", website: "https://pixelpaws.fun", github: "https://github.com/kitsune-dev/pixel-paws" },
    ai: {
      tldr: "Pixel Paws is a small browser game with a playable demo; the token is used for cosmetic items and breeding.",
      points: [
        "Playable demo is live on the website; about 3k players reported by the dev.",
        "Dev posts devlogs weekly and is pseudonymous but verified (X and GitHub proven).",
        "Token utility is cosmetic only; no staking or yield promises.",
      ],
      recent: [
        { at: iso(1 * D), text: "Devlog #6: breeding system and leaderboard preview." },
        { at: iso(4 * D), text: "Website now lists an in-game shop priced in $PAWS." },
      ],
      watchouts: ["Player numbers are self-reported.", "Top 10 wallets hold 31% of supply."],
    },
    repo: {
      repo: "kitsune-dev/pixel-paws",
      score: 71,
      verdict: "Genuine game code, solo developer, steady activity.",
      stars: 212,
      contributors: 1,
      commits30d: 64,
      lastCommit: iso(20 * H),
      languages: [
        { name: "TypeScript", pct: 82 },
        { name: "GLSL", pct: 10 },
        { name: "Other", pct: 8 },
      ],
      findings: [
        { label: "Original code", status: "good", detail: "Custom engine code, commit history matches devlogs." },
        { label: "Bus factor", status: "warn", detail: "Single contributor; project depends on one person." },
        { label: "Tests", status: "warn", detail: "Very few automated tests." },
      ],
    },
    claimCount: 6,
    lockPctSupply: 2.4,
  },
  {
    name: "Harbor",
    symbol: "HRBR",
    hue: 210,
    launchpad: "raydium",
    devId: "d4",
    ageH: 3 * 24,
    mcap: 860_000,
    graduated: true,
    trend: -0.2,
    description: "Community treasury that funds small Solana builders through holder votes.",
    links: { x: "https://x.com/harbor_dao", website: "https://harbordao.org" },
    ai: {
      tldr: "Harbor is a community grants pool. Holders vote on which small Solana projects receive funding from the treasury.",
      points: [
        "First grant round is open; 14 applications listed on the website.",
        "Treasury wallet is published on the site and can be tracked.",
        "Dev team has launched 3 tokens through this platform, all locks honoured.",
      ],
      recent: [{ at: iso(1 * D), text: "Grant round #1 voting dates announced on X." }],
      watchouts: ["No GitHub linked, so there is no code to analyse.", "Voting happens off-chain for now."],
    },
    claimCount: 4,
    lockPctSupply: 5.0,
  },
  {
    name: "Sol Sprout",
    symbol: "SPROUT",
    hue: 120,
    launchpad: "bonk",
    devId: "d3",
    ageH: 30,
    mcap: 182_000,
    graduated: false,
    trend: 0.5,
    description: "Plant-a-tree meme: a share of creator fees is donated to reforestation.",
    links: { x: "https://x.com/solsprout", website: "https://solsprout.earth" },
    ai: {
      tldr: "A meme token pledging part of creator fees to tree-planting charities. Early stage, still on the bonding curve.",
      points: [
        "Website lists a charity partner but no donation receipts yet.",
        "Dev is fully private: identity verified with us, nothing disclosed publicly.",
      ],
      recent: [{ at: iso(10 * H), text: "Pinned X post promises first donation once fees pass 10 SOL." }],
      watchouts: ["Charity donations are promised, not yet proven on-chain."],
    },
    claimCount: 2,
    lockPctSupply: 1.8,
  },
  {
    name: "Night Shift",
    symbol: "SHIFT",
    hue: 280,
    launchpad: "pumpfun",
    devId: "d5",
    ageH: 6,
    mcap: 41_000,
    graduated: false,
    trend: 1.2,
    description: "A meme for everyone trading at 3am.",
    links: { x: "https://x.com/nightshift_sol" },
    ai: {
      tldr: "A pure meme with no product. Community-driven, launched 6 hours ago.",
      points: ["No website or roadmap; the token is the product.", "Dev is private but verified with us; X ownership proven."],
      recent: [{ at: iso(2 * H), text: "Community raid thread on X gained traction." }],
      watchouts: ["Very early: price moves will be large in both directions."],
    },
    claimCount: 1,
    lockPctSupply: 3.0,
  },
  {
    name: "Ledgerless",
    symbol: "LGRL",
    hue: 180,
    launchpad: "meteora",
    devId: "d4",
    ageH: 12 * 24,
    mcap: 2_310_000,
    graduated: true,
    trend: 0.1,
    description: "Privacy-preserving receipts for on-chain payments.",
    links: { x: "https://x.com/ledgerless", website: "https://ledgerless.app", github: "https://github.com/harbor-labs/ledgerless" },
    ai: {
      tldr: "Ledgerless issues encrypted payment receipts so businesses can prove a Solana payment without exposing their whole wallet history.",
      points: [
        "Merchant SDK in beta; two pilot merchants named on the website.",
        "Token is used to pay for receipt storage.",
      ],
      recent: [{ at: iso(3 * D), text: "Published an audit request for proposals on X." }],
      watchouts: ["Not audited yet.", "Pilot merchants are not independently confirmed."],
    },
    repo: {
      repo: "harbor-labs/ledgerless",
      score: 58,
      verdict: "Real but young codebase; core cryptography is a wrapper over a well-known library.",
      stars: 88,
      contributors: 3,
      commits30d: 22,
      lastCommit: iso(4 * D),
      languages: [
        { name: "Rust", pct: 61 },
        { name: "TypeScript", pct: 39 },
      ],
      findings: [
        { label: "Original code", status: "good", detail: "Custom program logic around a standard crypto library." },
        { label: "Activity", status: "warn", detail: "Commits slowed in the last two weeks." },
        { label: "Audit", status: "bad", detail: "No audit report in the repo despite handling payment data." },
      ],
    },
    claimCount: 7,
    lockPctSupply: 3.5,
  },
];

function buildToken(s: Seed, i: number): Token {
  const r = rng(i * 97 + 7);
  const ch = (m: number) => Math.round((r() - 0.42 + s.trend * 0.15) * m * 10) / 10;
  const claimsList = claims(i * 13 + 5, s.claimCount, s.mcap > 1e6 ? 9 : 2.5).filter(
    (c) => Date.parse(c.at) > NOW - s.ageH * H,
  );
  const sources: NonNullable<Token["ai"]>["sources"] = [];
  if (s.links.x) sources.push({ kind: "x", label: "@" + s.links.x.split("/").pop(), url: s.links.x });
  if (s.links.website) sources.push({ kind: "web", label: s.links.website.replace("https://", ""), url: s.links.website });
  if (s.links.github) sources.push({ kind: "github", label: s.links.github.replace("https://github.com/", ""), url: s.links.github });
  const supply = 1_000_000_000;
  const start = NOW - s.ageH * H;
  return {
    mint: b58(1000 + i),
    name: s.name,
    symbol: s.symbol,
    hue: s.hue,
    launchpad: s.launchpad,
    devId: s.devId,
    createdAt: new Date(start).toISOString(),
    stage: s.graduated ? "graduated" : "bonding",
    bondingPct: s.graduated ? 100 : Math.round(20 + r() * 70),
    mcap: s.mcap,
    liquidity: Math.round(s.mcap * (0.08 + r() * 0.1)),
    volume24h: Math.round(s.mcap * (0.2 + r() * 0.9)),
    holders: Math.round(s.mcap / (180 + r() * 220)),
    change: { "5m": ch(3), "1h": ch(9), "6h": ch(22), "24h": ch(48) },
    description: s.description,
    links: s.links,
    totalSupply: supply,
    topHoldersPct: Math.round(18 + r() * 20),
    mintAuthorityOff: true,
    freezeAuthorityOff: true,
    lock: {
      provider: "Streamflow",
      contract: b58(2000 + i),
      amount: Math.round((supply * s.lockPctSupply) / 100),
      pctOfDevAllocation: 100,
      pctOfSupply: s.lockPctSupply,
      startsAt: new Date(start).toISOString(),
      unlocksAt: new Date(start + 365 * D).toISOString(),
      termMonths: 12,
    },
    feeClaims: claimsList,
    feesUnclaimedSol: Math.round(r() * 30) / 10,
    ai: { ...(s.ai as NonNullable<Token["ai"]>), updatedAt: iso((1 + Math.floor(r() * 5)) * H), sources },
    repo: s.repo ? { ...s.repo, updatedAt: iso((2 + Math.floor(r() * 10)) * H) } : undefined,
    series: series(i * 7 + 3, s.trend),
  };
}

export const TOKENS: Token[] = SEEDS.map(buildToken);
