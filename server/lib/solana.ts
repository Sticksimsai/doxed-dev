// Solana access via Helius (falls back to the public RPC for reads).
// Ported and trimmed from EZ Screener's helius.server.ts / locked-supply.server.ts / dev-fees.server.ts.
import bs58 from "bs58";
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

// ---------------------------------------------------------------- Streamflow locks

/**
 * Streamflow vesting contract layout (byte offsets). Mint/escrow/end_time match
 * EZ Screener's production detector; sender/recipient follow the same struct.
 * Verify against the Streamflow SDK before relying on cancel flags.
 */
const STREAMFLOW = "strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m";
const OFF = { endTime: 33, sender: 49, recipient: 113, mint: 177, escrow: 209 } as const;

const u64 = (b: Uint8Array, o: number) => {
  let v = 0;
  for (let i = 7; i >= 0; i--) v = v * 256 + b[o + i];
  return v;
};
const key = (b: Uint8Array, o: number) => bs58.encode(b.slice(o, o + 32));

export type StreamLock = { contract: string; sender: string; recipient: string; amount: number; endTime: number | null };

/** All live Streamflow streams for a mint, with their escrow balances. */
export async function streamflowLocks(mint: string): Promise<StreamLock[]> {
  const raw = await rpc<{ pubkey: string; account: { data: [string, "base64"] } }[]>("getProgramAccounts", [
    STREAMFLOW,
    { encoding: "base64", commitment: "confirmed", filters: [{ memcmp: { offset: OFF.mint, bytes: mint } }] },
  ]);
  const now = Math.floor(Date.now() / 1000);
  const parsed = (raw ?? [])
    .map((a) => {
      const b = Uint8Array.from(Buffer.from(a.account.data[0], "base64"));
      if (b.length < OFF.escrow + 32) return null;
      const end = u64(b, OFF.endTime);
      return {
        contract: a.pubkey,
        sender: key(b, OFF.sender),
        recipient: key(b, OFF.recipient),
        escrow: key(b, OFF.escrow),
        endTime: end > 1_600_000_000 && end < now + 50 * 365 * 86400 ? end : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const out: StreamLock[] = [];
  for (let i = 0; i < parsed.length; i += 100) {
    const chunk = parsed.slice(i, i + 100);
    const res = await rpc<{ value: ({ data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } | null)[] }>(
      "getMultipleAccounts",
      [chunk.map((c) => c.escrow), { encoding: "jsonParsed", commitment: "confirmed" }],
    );
    res.value.forEach((acc, j) => {
      const amount = acc?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
      if (amount > 0) out.push({ ...chunk[j], amount });
    });
  }
  return out;
}

export type LockCheck =
  | { ok: true; contract: string; amount: number; startsAt: Date; unlocksAt: Date; pctOfSupply: number | null }
  | { ok: false; reason: string };

/**
 * Launch policy: the dev wallet must hold 0 of the token, and Streamflow streams
 * sent by the dev wallet must hold > 0 tokens, all unlocking at least `minMonths` out.
 */
export async function checkDevLock(mint: string, devWallet: string, minMonths: number): Promise<LockCheck> {
  const [held, streams, supply] = await Promise.all([tokenBalance(devWallet, mint), streamflowLocks(mint), tokenSupply(mint)]);
  if (held > 0) return { ok: false, reason: `Dev wallet still holds ${held.toLocaleString()} tokens — lock 100% of them first.` };
  const mine = streams.filter((s) => s.sender === devWallet);
  if (!mine.length) return { ok: false, reason: "No Streamflow lock from the dev wallet was found for this token." };
  const minEnd = Date.now() / 1000 + minMonths * 30 * 86400 - 3 * 86400;
  const short = mine.filter((s) => !s.endTime || s.endTime < minEnd);
  if (short.length) return { ok: false, reason: `Lock unlocks too early — minimum term is ${minMonths} months.` };
  const amount = mine.reduce((s, x) => s + x.amount, 0);
  const unlock = Math.min(...mine.map((s) => s.endTime!));
  return {
    ok: true,
    contract: mine[0].contract,
    amount,
    startsAt: new Date(),
    unlocksAt: new Date(unlock * 1000),
    pctOfSupply: supply ? Math.round((amount / supply) * 1e4) / 100 : null,
  };
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
