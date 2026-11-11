// Shared domain types. The mock layer (./mock.ts) and the real API layer
// should both return these shapes, so the UI never changes when you swap.

export type LaunchpadId = "pumpfun" | "raydium" | "bonk" | "meteora" | "float";

export interface Launchpad {
  id: LaunchpadId;
  name: string;
  tagline: string;
  /** Where the token's liquidity moves once the bonding curve completes. Verify per launchpad. */
  graduatesTo: string;
  /** Short plain-language "why pick this one". */
  bestFor: string;
  color: string; // accent used for the launchpad chip
  available: boolean;
}

/**
 * How much of a dev's verified identity is shown publicly.
 * The full KYC record is always held privately by the platform.
 */
export type Disclosure = "private" | "pseudonymous" | "public";

export interface KydChecks {
  identity: boolean; // government ID matched
  liveness: boolean; // selfie / liveness check
  wallet: boolean; // signed message from launch wallet
  x: boolean; // proved control of the X account
  github: boolean; // proved control of the GitHub account
  screening: boolean; // sanctions / watch-list screening passed
}

export interface Dev {
  id: string;
  alias: string; // public handle shown everywhere
  wallet: string;
  disclosure: Disclosure;
  checks: KydChecks;
  verifiedAt: string; // ISO
  /** Only fields the dev chose to reveal. Anything missing renders as redacted. */
  revealed: {
    name?: string;
    x?: string;
    github?: string;
    region?: string;
    bio?: string;
    linkedin?: string;
  };
  stats: {
    launches: number;
    locksHonored: number;
    locksBroken: number;
    totalFeesClaimedSol: number;
  };
}

export interface Lock {
  provider: "Streamflow";
  contract: string;
  amount: number; // tokens locked
  pctOfDevAllocation: number; // always 100 by policy
  pctOfSupply: number;
  startsAt: string;
  unlocksAt: string;
  termMonths: number; // >= 12 by policy
}

export interface FeeClaim {
  signature: string;
  at: string;
  amountSol: number;
}

export type FindingStatus = "good" | "warn" | "bad";

export interface AiSummary {
  updatedAt: string;
  sources: { kind: "x" | "web" | "github"; label: string; url: string }[];
  tldr: string;
  points: string[];
  recent: { at: string; text: string }[];
  watchouts: string[];
}

export interface RepoAnalysis {
  repo: string; // owner/name
  updatedAt: string;
  score: number; // 0-100
  verdict: string;
  stars: number;
  contributors: number;
  commits30d: number;
  lastCommit: string;
  languages: { name: string; pct: number }[];
  findings: { label: string; status: FindingStatus; detail: string }[];
}

export interface Token {
  mint: string;
  name: string;
  symbol: string;
  hue: number; // icon colour seed
  launchpad: LaunchpadId;
  devId: string;
  createdAt: string;
  stage: "bonding" | "graduated";
  bondingPct: number;
  mcap: number;
  liquidity: number;
  volume24h: number;
  holders: number;
  change: { "5m": number; "1h": number; "6h": number; "24h": number };
  description: string;
  links: { x?: string; website?: string; github?: string; telegram?: string };
  totalSupply: number;
  topHoldersPct: number;
  mintAuthorityOff: boolean;
  freezeAuthorityOff: boolean;
  lock: Lock;
  feeClaims: FeeClaim[];
  /** null when the launchpad doesn't expose unclaimed fees */
  feesUnclaimedSol: number | null;
  /** undefined until the first AI pass has run */
  ai?: AiSummary;
  repo?: RepoAnalysis;
  series: number[]; // price history for the mini chart
}
