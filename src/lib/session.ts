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

export async function startDoxing(alias: string, disclosure: "private" | "pseudonymous" | "public") {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1200));
    mockMe = { ...mockMe, dev: { id: "d-preview", alias, disclosure, status: "approved" } };
    return { status: "approved" as const };
  }
  return http<{ status: "approved" | "pending"; redirectUrl?: string }>("/kyd/start", { method: "POST", json: { alias, disclosure } });
}
