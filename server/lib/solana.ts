// Solana access via Helius (falls back to the public RPC for reads).
// Ported and trimmed from EZ Screener's helius.server.ts / locked-supply.server.ts / dev-fees.server.ts.
import { env } from "../env";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRY = new Set([408, 429, 500, 502, 503, 504]);

function rpcUrl() {
  return env.heliusKey ? `https://mainnet.helius-rpc.com/?api-key=${env.heliusKey}` : "https://api.mainnet-beta.solana.com";
}

export async function rpc<T>(method: string, params: unknown[], attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(rpcUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (RETRY.has(res.status)) throw new Error(`rpc ${res.status}`);
      const json = (await res.json()) as { result?: T; error?: { message: string } };
      if (json.error) throw new Error(json.error.message);
      return json.result as T;
    } catch (err) {
      last = err;
      await sleep(Math.min(8000, 600 * 2 ** i) * (0.75 + Math.random() / 2));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

// ---------------------------------------------------------------- token balances

/** UI-amount balance of `mint` held by `owner` across all their token accounts. */
export async function tokenBalance(owner: string, mint: string): Promise<number> {
  const res = await rpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } }[] }>(
    "getTokenAccountsByOwner",
    [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }],
  );
  return res.value.reduce((s, a) => s + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
}

export async function tokenSupply(mint: string): Promise<number | null> {
  try {
    const r = await rpc<{ value: { uiAmount: number | null } }>("getTokenSupply", [mint]);
    return r.value.uiAmount;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- creator fee claims

type Transfer = { toUserAccount?: string; tokenAmount?: number; amount?: number; mint?: string };
type EnhancedTx = {
  signature: string;
  timestamp: number | null;
  type: string;
  feePayer?: string;
  tokenTransfers?: Transfer[];
  nativeTransfers?: Transfer[];
};
const WSOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type FeeClaim = { signature: string; at: Date; amountSol: number; amountUsdc: number; claimer: string };

/**
 * Creator-fee claims paid to the dev wallet for one token. Scans the token's pool
 * addresses (or the mint as a noisy fallback) — not the dev wallet itself, so claims
 * from the dev's other tokens are never attributed here.
 */
export async function devFeeClaims(devWallet: string, addresses: string[], maxPages = 5): Promise<FeeClaim[]> {
  if (!env.heliusKey || !addresses.length) return [];
  const seen = new Map<string, EnhancedTx>();
  for (const addr of [...new Set(addresses)]) {
    let before: string | undefined;
    for (let p = 0; p < maxPages; p++) {
      const u = new URL(`https://api.helius.xyz/v0/addresses/${addr}/transactions`);
      u.searchParams.set("api-key", env.heliusKey);
      u.searchParams.set("limit", "100");
      if (before) u.searchParams.set("before", before);
      const res = await fetch(u);
      if (!res.ok) break;
      const txs = (await res.json()) as EnhancedTx[];
      if (!Array.isArray(txs) || !txs.length) break;
      for (const t of txs) if (/^CLAIM/i.test(t.type)) seen.set(t.signature, t);
      before = txs[txs.length - 1].signature;
      if (txs.length < 100) break;
      await sleep(150);
    }
  }
  const out: FeeClaim[] = [];
  for (const tx of seen.values()) {
    // wSOL is often unwrapped in the same tx: take max(wSOL, native) per owner, never the sum.
    let wsol = 0;
    let native = 0;
    let usdc = 0;
    for (const t of tx.tokenTransfers ?? []) {
      if (t.toUserAccount !== devWallet) continue;
      if (t.mint === WSOL) wsol += t.tokenAmount ?? 0;
      if (t.mint === USDC) usdc += t.tokenAmount ?? 0;
    }
    for (const n of tx.nativeTransfers ?? []) if (n.toUserAccount === devWallet) native += (n.amount ?? 0) / 1e9;
    const solAmt = Math.max(wsol, native);
    // Only count claims where the dev wallet actually received the fees.
    if (solAmt <= 0.0005 && usdc <= 0.01) continue;
    out.push({ signature: tx.signature, at: new Date((tx.timestamp ?? 0) * 1000), amountSol: solAmt, amountUsdc: usdc, claimer: devWallet });
  }
  return out.sort((a, b) => +b.at - +a.at);
}
