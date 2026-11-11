// Live market data from Jupiter's asset API (the same source EZ Screener used).
export type JupAsset = {
  id: string;
  name?: string;
  symbol?: string;
  dev?: string;
  totalSupply?: number;
  holderCount?: number;
  mcap?: number;
  usdPrice?: number;
  liquidity?: number;
  graduatedPool?: string;
  bondingCurve?: number;
  stats5m?: { priceChange?: number };
  stats1h?: { priceChange?: number };
  stats6h?: { priceChange?: number };
  stats24h?: { priceChange?: number; buyVolume?: number; sellVolume?: number };
  audit?: { mintAuthorityDisabled?: boolean; freezeAuthorityDisabled?: boolean; topHoldersPercentage?: number };
};

export async function fetchAsset(mint: string): Promise<JupAsset | null> {
  try {
    const res = await fetch(`https://datapi.jup.ag/v1/assets/search?query=${mint}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const arr = (await res.json()) as JupAsset[];
    return arr.find((a) => a.id === mint) ?? null;
  } catch {
    return null;
  }
}

export function toMarketRow(a: JupAsset) {
  const s24 = a.stats24h ?? {};
  return {
    mcap: a.mcap ?? null,
    liquidity: a.liquidity ?? null,
    volume24h: (s24.buyVolume ?? 0) + (s24.sellVolume ?? 0),
    holders: a.holderCount ?? null,
    total_supply: a.totalSupply ?? null,
    change_5m: a.stats5m?.priceChange ?? null,
    change_1h: a.stats1h?.priceChange ?? null,
    change_6h: a.stats6h?.priceChange ?? null,
    change_24h: s24.priceChange ?? null,
    top_holders_pct: a.audit?.topHoldersPercentage ?? null,
    mint_authority_off: a.audit?.mintAuthorityDisabled ?? null,
    freeze_authority_off: a.audit?.freezeAuthorityDisabled ?? null,
    bonding_pct: a.graduatedPool ? 100 : (a.bondingCurve ?? null),
    graduated_pool: a.graduatedPool ?? null,
    price: a.usdPrice ?? null,
  };
}
