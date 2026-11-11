// Meteora Dynamic Bonding Curve launches.
// Every launch uses the same preset (supply, curve, graduation, LP lock). The only thing a dev picks is the
// trading tax. Each tax tier maps to one on-chain pool config ("config key"), created once by an admin and
// then shared by every launch in that tier.
import { createHash } from "node:crypto";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DammV2DynamicFeeMode,
  DynamicBondingCurveClient,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithMarketCap,
  deriveDbcPoolAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { env } from "../env";
import { sql } from "../db";

export const DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
export const DAMM_V2_PROGRAM = "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG";
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

const rpc = () => (env.heliusKey ? `https://mainnet.helius-rpc.com/?api-key=${env.heliusKey}` : "https://api.mainnet-beta.solana.com");
const client = () => new DynamicBondingCurveClient(new Connection(rpc(), "confirmed"), "confirmed");

/** The shared preset. Change these and new config keys are needed (old launches keep theirs). */
export const PRESET = {
  totalSupply: 1_000_000_000,
  decimals: 6,
  initialMarketCapSol: env.meteoraInitialMcapSol,
  graduationMarketCapSol: env.meteoraGraduationMcapSol,
  creatorFeeShare: env.meteoraCreatorFeeShare, // % of the tax that goes to the dev; the rest to the platform
};

export const taxOptions = () => env.meteoraTaxOptions.map((p) => Math.round(p * 100)).filter((b) => b >= 25 && b <= 1000);

export function presetHash(taxBps: number) {
  return createHash("sha256").update(JSON.stringify({ v: 1, taxBps, ...PRESET, feeClaimer: feeClaimer()?.toBase58() ?? "" })).digest("hex").slice(0, 16);
}

const feeClaimer = () => (env.treasuryWallet ? new PublicKey(env.treasuryWallet) : null);

export function presetParams(taxBps: number) {
  const creator = PRESET.creatorFeeShare;
  return buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: 9,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: PRESET.totalSupply,
      leftover: 0,
    },
    fee: {
      // Flat tax: same fee from first trade to graduation.
      baseFeeParams: { baseFeeMode: BaseFeeMode.FeeSchedulerLinear, feeSchedulerParam: { startingFeeBps: taxBps, endingFeeBps: taxBps, numberOfPeriod: 0, totalDuration: 0 } },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken, // tax is paid in SOL
      creatorTradingFeePercentage: creator,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.Customizable,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
      // Same tax after graduation, paid in SOL.
      migratedPoolFee: { collectFeeMode: MigratedCollectFeeMode.QuoteToken, dynamicFee: DammV2DynamicFeeMode.Disabled, poolFeeBps: taxBps },
    },
    // 100% of graduated liquidity is locked forever; LP fees split like the tax.
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 100 - creator,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: creator,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
    activationType: ActivationType.Timestamp,
    initialMarketCap: PRESET.initialMarketCapSol,
    migrationMarketCap: PRESET.graduationMarketCapSol,
  });
}

/** Config keys from env ("3:Key,5:Key") win over ones created through /admin. */
function envConfigs(): Map<number, string> {
  const m = new Map<number, string>();
  for (const part of env.meteoraConfigs.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [pct, key] = part.split(":").map((s) => s.trim());
    const bps = Math.round(Number(pct) * 100);
    if (bps > 0 && key) m.set(bps, key);
  }
  return m;
}

export async function presetTiers(): Promise<{ taxBps: number; config: string | null }[]> {
  const fromEnv = envConfigs();
  const rows = await sql<{ tax_bps: number; preset_hash: string; config: string }[]>`select tax_bps, preset_hash, config from meteora_presets`;
  const opts = [...new Set([...taxOptions(), ...fromEnv.keys()])].sort((a, b) => a - b);
  return opts.map((taxBps) => ({
    taxBps,
    config: fromEnv.get(taxBps) ?? rows.find((r) => r.tax_bps === taxBps && r.preset_hash === presetHash(taxBps))?.config ?? null,
  }));
}

export async function configFor(taxBps: number) {
  return (await presetTiers()).find((t) => t.taxBps === taxBps)?.config ?? null;
}

async function toV0(payer: PublicKey, ixs: TransactionInstruction[], cu = 400_000) {
  const c = new Connection(rpc(), "confirmed");
  const { blockhash } = await c.getLatestBlockhash("confirmed");
  const hasBudget = ixs.some((i) => i.programId.equals(ComputeBudgetProgram.programId));
  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [
      ...(hasBudget ? [] : [ComputeBudgetProgram.setComputeUnitLimit({ units: cu }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Math.round((env.priorityFeeSol * 1e15) / cu) })]),
      ...ixs,
    ],
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}

/** Admin: one transaction that creates the shared config for a tax tier. The admin's wallet pays the rent (~0.01 SOL). */
export async function buildPresetConfigTx(adminWallet: string, taxBps: number) {
  if (!taxOptions().includes(taxBps)) throw new Error("That tax isn't one of the offered options.");
  const fc = feeClaimer();
  if (!fc) throw new Error("Set TREASURY_WALLET first — it receives the platform's share of the tax.");
  const config = Keypair.generate();
  const payer = new PublicKey(adminWallet);
  const tx = await client().partner.createConfig2({
    ...presetParams(taxBps),
    config: config.publicKey,
    feeClaimer: fc,
    leftoverReceiver: fc,
    quoteMint: WSOL,
    payer,
    transferFeeParameters: null,
  });
  const v0 = await toV0(payer, tx.instructions, 300_000);
  v0.sign([config]);
  return { config: config.publicKey.toBase58(), tx: Buffer.from(v0.serialize()).toString("base64") };
}

/** Admin: after the config tx confirms, check it on-chain and remember it. */
export async function savePresetConfig(taxBps: number, config: string, by: string) {
  const cfg = await client().state.getPoolConfig(config);
  if (!cfg) throw new Error("Config not found on-chain yet — wait a few seconds and retry.");
  const fee = Number(cfg.poolFees.baseFee.cliffFeeNumerator.toString());
  if (fee !== taxBps * 100_000) throw new Error("That config's tax doesn't match.");
  if (cfg.creatorTradingFeePercentage !== PRESET.creatorFeeShare) throw new Error("That config's fee split doesn't match the preset.");
  if (feeClaimer() && cfg.feeClaimer.toBase58() !== feeClaimer()!.toBase58()) throw new Error("That config pays a different treasury.");
  await sql`insert into meteora_presets (tax_bps, preset_hash, config, created_by) values (${taxBps}, ${presetHash(taxBps)}, ${config}, ${by})
            on conflict (tax_bps, preset_hash) do update set config = excluded.config, created_by = excluded.created_by, created_at = now()`;
}

/** Dev: create the token on the preset config for their tax tier, with the dev buy in the same transaction. */
export async function buildMeteoraCreateTx(p: { wallet: string; name: string; symbol: string; uri: string; devBuySol: number; taxBps: number }) {
  const config = await configFor(p.taxBps);
  if (!config) throw new Error(`The ${p.taxBps / 100}% tax option isn't switched on yet — pick another.`);
  const mint = Keypair.generate();
  const owner = new PublicKey(p.wallet);
  const configPk = new PublicKey(config);
  const tx = await client().creator.createPoolWithFirstBuy({
    createPoolParam: { name: p.name, symbol: p.symbol, uri: p.uri, payer: owner, poolCreator: owner, config: configPk, baseMint: mint.publicKey },
    // Same transaction as pool creation, so nothing can trade in between; no min-out needed.
    firstBuyParam: { buyer: owner, buyAmount: new BN(Math.round(p.devBuySol * 1e9)), minimumAmountOut: new BN(1), referralTokenAccount: null },
  });
  const v0 = await toV0(owner, tx.instructions);
  v0.sign([mint]);
  return {
    mint: mint.publicKey.toBase58(),
    pool: deriveDbcPoolAddress(WSOL, mint.publicKey, configPk).toBase58(),
    tx: Buffer.from(v0.serialize()).toString("base64"),
  };
}

/** Unclaimed creator tax (SOL) sitting in a bonding-curve pool. */
export async function unclaimedCreatorFeeSol(pool: string): Promise<number | null> {
  const p = await client().state.getPool(pool).catch(() => null);
  if (!p) return null;
  return Number(p.poolState.creatorQuoteFee.toString()) / 1e9;
}
