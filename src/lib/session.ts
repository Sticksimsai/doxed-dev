// Wallet connection + Sign-in with Solana, and the current session.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import bs58 from "bs58";
import { http, USE_MOCK } from "./api";

type Provider = {
  publicKey?: { toString(): string } | null;
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
  signMessage: (msg: Uint8Array, display?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
};

/** Phantom, Solflare and Backpack all inject a provider with this shape. */
export function getWallet(): Provider | null {
  const w = window as unknown as Record<string, any>;
  return w.phantom?.solana ?? w.solflare ?? w.backpack ?? (w.solana?.signMessage ? w.solana : null);
}

export type Me = {
  wallet: string | null;
  isAdmin?: boolean;
  dev: { id: string; alias: string; disclosure: "private" | "pseudonymous" | "public"; status: "pending" | "approved" | "rejected" } | null;
};

let mockMe: Me = { wallet: null, dev: null };

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => (USE_MOCK ? Promise.resolve(mockMe) : http<Me>("/me")),
    staleTime: 30_000,
  });
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (USE_MOCK) {
        mockMe = { ...mockMe, wallet: "7xKpDemoWa11etPreview9fQa" };
        return;
      }
      const provider = getWallet();
      if (!provider) {
        window.open("https://phantom.com/download", "_blank", "noopener");
        throw new Error("No Solana wallet found. Install Phantom, Solflare or Backpack, then try again.");
      }
      const { publicKey } = await provider.connect();
      const wallet = publicKey.toString();
      const { nonce, message } = await http<{ nonce: string; message: string }>("/auth/nonce", { method: "POST", json: { wallet } });
      const signed = await provider.signMessage(new TextEncoder().encode(message), "utf8");
      const sig = signed instanceof Uint8Array ? signed : signed.signature;
      await http("/auth/verify", { method: "POST", json: { wallet, nonce, signature: bs58.encode(sig) } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (USE_MOCK) mockMe = { wallet: null, dev: null };
      else await http("/auth/logout", { method: "POST" });
      await getWallet()?.disconnect?.().catch(() => {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}


// ------------------------------------------------------------------ verification status
export type KydState = { status: "none" | "pending" | "in_progress" | "approved" | "rejected" | "review"; url?: string; reasons?: string[] };
let mockKyd: KydState = { status: "none" };

export function useKydStatus(enabled: boolean, poll: boolean) {
  return useQuery({
    queryKey: ["kyd"],
    queryFn: () => (USE_MOCK ? Promise.resolve(mockKyd) : http<KydState>("/kyd/status")),
    enabled,
    refetchInterval: poll ? 4000 : false,
  });
}

export async function beginKyd(alias: string, disclosure: "private" | "pseudonymous" | "public"): Promise<KydState> {
  if (USE_MOCK) {
    mockKyd = { status: "in_progress", url: "about:blank" };
    setTimeout(() => {
      mockKyd = { status: "approved" };
      mockMe = { ...mockMe, dev: { id: "d-preview", alias, disclosure, status: "approved" } };
    }, 5000);
    return mockKyd;
  }
  return http<KydState>("/kyd/start", { method: "POST", json: { alias, disclosure } });
}

// ------------------------------------------------------------------ transactions
/** Has the connected wallet sign a server-built transaction, then sends it. Returns the signature. */
export async function signAndSend(base64Tx: string): Promise<string> {
  const [{ VersionedTransaction }, { Buffer }] = await Promise.all([import("@solana/web3.js"), import("buffer")]);
  (globalThis as any).Buffer ??= Buffer;
  const provider = getWallet() as any;
  if (!provider) throw new Error("Wallet not connected.");
  const tx = VersionedTransaction.deserialize(Uint8Array.from(Buffer.from(base64Tx, "base64")));
  if (typeof provider.signAndSendTransaction === "function") {
    const r = await provider.signAndSendTransaction(tx);
    return typeof r === "string" ? r : r.signature;
  }
  const signed = await provider.signTransaction(tx);
  const r = await http<{ signature: string }>("/tx/send", { method: "POST", json: { tx: Buffer.from(signed.serialize()).toString("base64") } });
  return r.signature;
}

export async function waitForConfirmation(sig: string, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await http<{ state: "pending" | "confirmed" | "failed"; error?: string }>(`/tx/${sig}`);
    if (s.state === "confirmed") return;
    if (s.state === "failed") throw new Error(`Transaction failed on-chain: ${s.error}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Transaction wasn't confirmed in time — check your wallet activity, then retry.");
}
