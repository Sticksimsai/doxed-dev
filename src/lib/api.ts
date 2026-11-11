// Single seam between UI and data. Each function is async so swapping the
// mock for real calls (Supabase / server functions / Helius) is drop-in.
import { DEVS, LAUNCHPADS, TOKENS } from "./mock";
import type { Dev, Launchpad, Token } from "./types";

const wait = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export async function listTokens(): Promise<Token[]> {
  // LIVE: Jupiter/Helius market data joined with `launches` + `locks` tables.
  return wait(TOKENS);
}

export async function getToken(mint: string): Promise<Token | undefined> {
  return wait(TOKENS.find((t) => t.mint === mint));
}

export async function listLaunchpads(): Promise<Launchpad[]> {
  return wait(LAUNCHPADS, 0);
}

export async function getDev(id: string): Promise<Dev | undefined> {
  // LIVE: read from `dev_public_profiles` view only — never the private KYC table.
  return wait(DEVS.find((d) => d.id === id));
}

export async function listDevs(): Promise<Dev[]> {
  return wait(DEVS);
}

export function launchpadById(id: string) {
  return LAUNCHPADS.find((l) => l.id === id)!;
}

export function devById(id: string) {
  return DEVS.find((d) => d.id === id);
}

export function tokensByDev(devId: string) {
  return TOKENS.filter((t) => t.devId === devId);
}
