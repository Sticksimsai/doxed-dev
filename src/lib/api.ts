// Single seam between UI and data.
// Preview builds (and VITE_USE_MOCK=true) use the demo data in ./mock.ts;
// everything else talks to the Node API under /api.
import { DEVS, LAUNCHPADS, TOKENS } from "./mock";
import type { Dev, Launchpad, Token } from "./types";

export const USE_MOCK = import.meta.env.MODE === "preview" || import.meta.env.VITE_USE_MOCK === "true";

const devCache = new Map<string, Dev>();
const remember = (devs: (Dev | null | undefined)[]) => devs.forEach((d) => d && devCache.set(d.id, d));
if (USE_MOCK) remember(DEVS);

const wait = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function http<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { ...(init?.json !== undefined ? { "content-type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export async function listTokens(): Promise<Token[]> {
  if (USE_MOCK) return wait(TOKENS);
  const r = await http<{ tokens: Token[]; devs: Dev[] }>("/tokens");
  remember(r.devs);
  return r.tokens;
}

export async function getToken(mint: string): Promise<Token | undefined> {
  if (USE_MOCK) return wait(TOKENS.find((t) => t.mint === mint));
  try {
    const r = await http<{ token: Token; dev: Dev | null }>(`/tokens/${mint}`);
    remember([r.dev]);
    return r.token;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

export async function getDevWithTokens(id: string): Promise<{ dev: Dev; tokens: Token[] } | undefined> {
  if (USE_MOCK) {
    const dev = DEVS.find((d) => d.id === id);
    return wait(dev ? { dev, tokens: TOKENS.filter((t) => t.devId === id) } : undefined);
  }
  try {
    const r = await http<{ dev: Dev; tokens: Token[] }>(`/devs/${id}`);
    remember([r.dev]);
    return r;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

export async function listLaunchpads(): Promise<Launchpad[]> {
  return LAUNCHPADS;
}

const LEGACY: Record<string, string> = { bonk: "LetsBonk", raydium: "Raydium LaunchLab", float: "Float" };
export function launchpadById(id: string) {
  return LAUNCHPADS.find((l) => l.id === id) ?? { ...LAUNCHPADS[0], id: id as never, name: LEGACY[id] ?? id, available: false };
}

/** Synchronous lookup — filled by the list/detail calls above. */
export function devById(id: string) {
  return devCache.get(id);
}
