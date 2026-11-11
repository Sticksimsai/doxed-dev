// In-app launches. The server builds transactions; the dev's wallet signs them. We never hold user keys.
//   1. metadata  → IPFS (Pinata for Pump.fun, LetsBonk's uploader for Bonk)
//   2. create    → PumpPortal "trade-local" builds create + dev buy; we pre-sign with a fresh mint keypair
//   3. lock      → Streamflow token lock for 100% of the dev wallet's balance, non-cancellable
import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { ICluster, SolanaStreamClient, StreamType, buildLockParams } from "@streamflow/stream";
import { env } from "../env";

export const IN_APP_LAUNCHPADS = ["pumpfun", "bonk"] as const;
export type InAppLaunchpad = (typeof IN_APP_LAUNCHPADS)[number];

export const rpcUrl = () =>
  env.heliusKey ? `https://mainnet.helius-rpc.com/?api-key=${env.heliusKey}` : "https://api.mainnet-beta.solana.com";
const conn = () => new Connection(rpcUrl(), "confirmed");
const streamClient = () => new SolanaStreamClient({ clusterUrl: rpcUrl(), cluster: ICluster.Mainnet });

// ------------------------------------------------------------------ 1. metadata
export type MetaInput = {
  launchpad: InAppLaunchpad;
  image: Blob;
  imageName: string;
  name: string;
  symbol: string;
  description?: string;
  x?: string;
  website?: string;
  telegram?: string;
};

async function pinata(file: Blob, name: string) {
  const fd = new FormData();
  fd.append("network", "public");
  fd.append("file", file, name);
  const res = await fetch("https://uploads.pinata.cloud/v3/files", { method: "POST", headers: { authorization: `Bearer ${env.pinataJwt}` }, body: fd });
  if (!res.ok) throw new Error(`Image host error (${res.status})`);
  const j = (await res.json()) as { data: { cid: string } };
  return `https://ipfs.io/ipfs/${j.data.cid}`;
}

export async function uploadMetadata(m: MetaInput): Promise<{ uri: string; image: string }> {
  if (m.launchpad === "bonk") {
    const fd = new FormData();
    fd.append("image", m.image, m.imageName);
    const img = await fetch("https://nft-storage.letsbonk22.workers.dev/upload/img", { method: "POST", body: fd });
    if (!img.ok) throw new Error("Image upload failed — try a smaller PNG or JPG.");
    const image = (await img.text()).trim();
    const meta = await fetch("https://nft-storage.letsbonk22.workers.dev/upload/meta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        createdOn: "https://bonk.fun",
        name: m.name,
        symbol: m.symbol,
        description: m.description ?? "",
        image,
        website: m.website ?? "",
        twitter: m.x ?? "",
        telegram: m.telegram ?? "",
      }),
    });
    if (!meta.ok) throw new Error("Couldn't save token details — try again.");
    return { uri: (await meta.text()).trim(), image };
  }
  if (!env.pinataJwt) throw new Error("Pump.fun launches aren't enabled yet — LetsBonk works now.");
  const image = await pinata(m.image, m.imageName);
  const json = JSON.stringify({
    name: m.name,
    symbol: m.symbol,
    description: m.description ?? "",
    image,
    showName: true,
    createdOn: "https://pump.fun",
    twitter: m.x ?? undefined,
    telegram: m.telegram ?? undefined,
    website: m.website ?? undefined,
  });
  const uri = await pinata(new Blob([json], { type: "application/json" }), "metadata.json");
  return { uri, image };
}

// ------------------------------------------------------------------ 2. create + dev buy
export async function buildCreateTx(p: { wallet: string; launchpad: InAppLaunchpad; name: string; symbol: string; uri: string; devBuySol: number }) {
  const mint = Keypair.generate();
  const res = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      publicKey: p.wallet,
      action: "create",
      tokenMetadata: { name: p.name, symbol: p.symbol, uri: p.uri },
      mint: mint.publicKey.toBase58(),
      denominatedInSol: "true",
      amount: p.devBuySol,
      slippage: 10,
      priorityFee: env.priorityFeeSol,
      pool: p.launchpad === "bonk" ? "bonk" : "pump",
    }),
  });
  if (res.status !== 200) throw new Error(`Couldn't build the launch transaction (${res.status} ${res.statusText}).`);
  const tx = VersionedTransaction.deserialize(new Uint8Array(await res.arrayBuffer()));
  // Sanity: the dev wallet must be the fee payer, and the only other required signer is our mint keypair.
  const keys = tx.message.staticAccountKeys;
  if (!keys[0].equals(new PublicKey(p.wallet))) throw new Error("Unexpected fee payer in launch transaction.");
  tx.sign([mint]); // partial: the dev's wallet adds its signature
  return { mint: mint.publicKey.toBase58(), tx: Buffer.from(tx.serialize()).toString("base64") };
}

// ------------------------------------------------------------------ 3. lock 100% of the dev bag
async function rawBalance(owner: PublicKey, mint: PublicKey) {
  const r = await conn().getParsedTokenAccountsByOwner(owner, { mint });
  return r.value.reduce((s, a) => s.add(new BN(a.account.data.parsed.info.tokenAmount.amount as string)), new BN(0));
}

export async function buildLockTx(p: { wallet: string; mint: string; months: number; symbol: string }) {
  const c = conn();
  const owner = new PublicKey(p.wallet);
  const mint = new PublicKey(p.mint);
  const [info, amount] = await Promise.all([c.getAccountInfo(mint), rawBalance(owner, mint)]);
  if (!info) throw new Error("Token not found on-chain yet — wait a few seconds and retry.");
  if (amount.lten(1)) throw new Error("Your wallet holds none of this token yet, so there's nothing to lock.");

  const unlockDate = Math.floor(Date.now() / 1000 + p.months * 30.44 * 86400) + 3600;
  const { ixs, metadata, metadataPubKey } = await streamClient().prepareCreateInstructions(
    buildLockParams({
      recipient: p.wallet, // locked to the dev's own wallet; withdrawable only after unlock
      tokenId: p.mint,
      amount,
      unlockDate,
      name: `${p.symbol} dev lock`.slice(0, 64),
      transferableByRecipient: false,
      tokenProgramId: info.owner,
    }),
    { sender: { publicKey: owner }, isNative: false },
  );
  const { blockhash } = await c.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: owner,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      ...ixs,
      // Platform launch fee, paid once with the lock (covers Builder API compute + infra).
      ...(env.launchFeeSol > 0 && env.treasuryWallet
        ? [SystemProgram.transfer({ fromPubkey: owner, toPubkey: new PublicKey(env.treasuryWallet), lamports: Math.round(env.launchFeeSol * LAMPORTS_PER_SOL) })]
        : []),
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  if (metadata) tx.sign([metadata]);
  return { tx: Buffer.from(tx.serialize()).toString("base64"), lockId: metadataPubKey.toBase58(), amount: amount.toString(), unlockDate };
}

export async function sendSigned(base64: string) {
  return conn().sendRawTransaction(Buffer.from(base64, "base64"), { maxRetries: 3 });
}

// ------------------------------------------------------------------ verification
export async function signatureStatus(sig: string) {
  const r = await conn().getSignatureStatuses([sig], { searchTransactionHistory: true });
  const s = r.value[0];
  if (!s) return { state: "pending" as const };
  if (s.err) return { state: "failed" as const, error: JSON.stringify(s.err) };
  return { state: s.confirmationStatus === "processed" ? ("pending" as const) : ("confirmed" as const) };
}

export type LockVerdict =
  | { ok: true; contract: string; amount: number; startsAt: Date; unlocksAt: Date; pctOfSupply: number | null }
  | { ok: false; reason: string };

/**
 * Policy: the dev wallet holds 0 tokens, and a non-cancellable Streamflow *lock* sent by the dev wallet
 * holds tokens of this mint, unlocking ≥ minMonths from now. Checked with the official SDK decoder.
 */
export async function verifyLock(mint: string, wallet: string, minMonths: number, candidates: string[]): Promise<LockVerdict> {
  const c = conn();
  const owner = new PublicKey(wallet);
  const mintPk = new PublicKey(mint);
  const held = await rawBalance(owner, mintPk);
  if (held.gtn(1)) return { ok: false, reason: "Your wallet still holds some of this token — lock 100% of it first." };

  const client = streamClient();
  const ids = [...new Set(candidates)];
  if (!ids.length) {
    const all = await client.get({ address: wallet, type: StreamType.Lock }).catch(() => [] as [string, unknown][]);
    for (const [id] of all as [string, unknown][]) ids.push(id);
  }
  const minEnd = Date.now() / 1000 + minMonths * 30 * 86400 - 3 * 86400;
  let total = new BN(0);
  let earliest = Infinity;
  let first: string | null = null;
  let start = Infinity;
  for (const id of ids) {
    const s = await client.getOne({ id }).catch(() => null);
    if (!s || s.mint !== mint || s.sender !== wallet || s.closed) continue;
    if (s.cancelableBySender || s.cancelableByRecipient || s.canTopup) return { ok: false, reason: "That lock can be cancelled or topped up — it must be a plain, non-cancellable lock." };
    const unlock = Math.max(s.end, s.cliff);
    if (unlock < minEnd) return { ok: false, reason: `The lock unlocks too early — minimum term is ${minMonths} months.` };
    total = total.add(s.depositedAmount.sub(s.withdrawnAmount));
    earliest = Math.min(earliest, unlock);
    start = Math.min(start, s.createdAt || s.start);
    first ??= id;
  }
  if (!first || total.lten(1)) return { ok: false, reason: "No lock from your wallet was found for this token yet." };

  const supply = await c.getTokenSupply(mintPk);
  const dec = supply.value.decimals;
  const amountUi = Number(total.toString()) / 10 ** dec;
  const supplyUi = supply.value.uiAmount ?? null;
  return {
    ok: true,
    contract: first,
    amount: amountUi,
    startsAt: new Date((isFinite(start) ? start : Date.now() / 1000) * 1000),
    unlocksAt: new Date(earliest * 1000),
    pctOfSupply: supplyUi ? Math.round((amountUi / supplyUi) * 1e4) / 100 : null,
  };
}
