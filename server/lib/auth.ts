// Sign-in with Solana: the wallet signs a one-time message; we verify the ed25519
// signature and issue an httpOnly session cookie (JWT).
import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { SignJWT, jwtVerify } from "jose";
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sql } from "../db";
import { env } from "../env";

const secret = new TextEncoder().encode(env.sessionSecret);
const COOKIE = "doxed_session";

export const signInMessage = (wallet: string, nonce: string, host: string) =>
  `${host} wants you to sign in with your Solana account:\n${wallet}\n\nSign in to Doxed Dev. This does not cost anything or move funds.\n\nNonce: ${nonce}`;

export async function createNonce(wallet: string) {
  const nonce = randomBytes(16).toString("hex");
  await sql`delete from auth_nonces where created_at < now() - interval '10 minutes'`;
  await sql`insert into auth_nonces (nonce, wallet) values (${nonce}, ${wallet})`;
  return nonce;
}

export async function verifySignIn(wallet: string, nonce: string, signatureB58: string, host: string) {
  const rows = await sql`delete from auth_nonces where nonce = ${nonce} and wallet = ${wallet}
                         and created_at > now() - interval '10 minutes' returning nonce`;
  if (!rows.length) return false;
  try {
    const msg = new TextEncoder().encode(signInMessage(wallet, nonce, host));
    return nacl.sign.detached.verify(msg, bs58.decode(signatureB58), bs58.decode(wallet));
  } catch {
    return false;
  }
}

export async function startSession(c: Context, wallet: string) {
  const jwt = await new SignJWT({ wallet }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret);
  setCookie(c, COOKIE, jwt, { httpOnly: true, secure: env.isProd, sameSite: "Lax", path: "/", maxAge: 7 * 86400 });
}

export const endSession = (c: Context) => deleteCookie(c, COOKIE, { path: "/" });

export async function sessionWallet(c: Context): Promise<string | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.wallet === "string" ? payload.wallet : null;
  } catch {
    return null;
  }
}

/** Route guard: requires a signed-in wallet; exposes it as c.get("wallet"). */
export async function requireWallet(c: Context, next: Next) {
  const wallet = await sessionWallet(c);
  if (!wallet) return c.json({ error: "Sign in with your wallet first." }, 401);
  c.set("wallet", wallet);
  await next();
}
