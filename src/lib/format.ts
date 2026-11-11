import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

export function usd(n?: number, compact = true) {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
}

export const int = (n?: number) => (n == null ? "—" : new Intl.NumberFormat("en-US").format(Math.round(n)));
export const compact = (n?: number) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function pct(n?: number, sign = true) {
  if (n == null || !isFinite(n)) return "—";
  return `${sign && n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export const deltaClass = (n?: number) => (n == null || n === 0 ? "text-muted-foreground" : n > 0 ? "text-success" : "text-danger");

export function ago(isoStr: string) {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(isoStr)) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}

export function date(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const short = (s: string, a = 4, b = 4) => (s.length <= a + b + 1 ? s : `${s.slice(0, a)}…${s.slice(-b)}`);

export function sol(n: number) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} SOL`;
}
