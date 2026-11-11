// Code-style motion: typing terminal, live event ticker, text scramble, typewriter.
// All respect prefers-reduced-motion.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const GLYPHS = "!<>-_\\/[]{}=+*^?#$%&01";

/** Scrambles from random glyphs into the final text. */
export function Scramble({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const [out, setOut] = useState(reduced() ? text : text.replace(/\S/g, " "));
  useEffect(() => {
    if (reduced()) return setOut(text);
    let frame = 0;
    let raf = 0;
    const total = 26 + text.length;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      if (now < start) {
        raf = requestAnimationFrame(tick);
        return;
      }
      frame++;
      setOut(
        [...text]
          .map((ch, i) => {
            if (ch === " ") return " ";
            const reveal = (i / text.length) * 22 + 4;
            return frame >= reveal ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join(""),
      );
      if (frame < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, delay]);
  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  );
}

export function Cursor({ className }: { className?: string }) {
  return <span className={cn("blink ml-1 inline-block h-[0.9em] w-[0.5em] translate-y-[0.1em] bg-current", className)} aria-hidden />;
}

/** Types text once, character by character. */
export function Typewriter({ text, speed = 12, className }: { text: string; speed?: number; className?: string }) {
  const [n, setN] = useState(reduced() ? text.length : 0);
  useEffect(() => {
    if (reduced()) return;
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 2)), speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && <Cursor />}
    </span>
  );
}

type Line = { t: "cmd" | "ok" | "info" | "dim"; s: string };
const SCRIPT: Line[] = [
  { t: "cmd", s: "doxed verify --wallet 7xKp…9fQa" },
  { t: "info", s: "→ id document ............ matched" },
  { t: "info", s: "→ liveness ............... passed" },
  { t: "info", s: "→ sanctions screen ....... clear" },
  { t: "ok", s: "✓ dev doxed (private) · details redacted" },
  { t: "cmd", s: "doxed launch $ORBIT --on meteora --dev-buy 2" },
  { t: "info", s: "→ mint created ........... dyXg…jiBP" },
  { t: "info", s: "→ dev buy ................ 41,000,000 ORBIT" },
  { t: "cmd", s: "doxed lock --all --months 12" },
  { t: "ok", s: "✓ 100% of dev tokens locked until Oct 2027" },
  { t: "dim", s: "listed on doxed.dev/discover" },
];

/** Looping terminal that types out the verify → launch → lock flow. */
export function TerminalDemo({ className }: { className?: string }) {
  const [lines, setLines] = useState<Line[]>(reduced() ? SCRIPT : []);
  const [typing, setTyping] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced()) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      while (!cancelled) {
        setLines([]);
        for (const l of SCRIPT) {
          if (cancelled) return;
          if (l.t === "cmd") {
            for (let i = 1; i <= l.s.length; i++) {
              if (cancelled) return;
              setTyping(l.s.slice(0, i));
              await sleep(28 + Math.random() * 40);
            }
            await sleep(260);
            setTyping("");
          } else await sleep(l.t === "ok" ? 420 : 180);
          setLines((p) => [...p, l]);
        }
        await sleep(3800);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [lines, typing]);

  return (
    <div className={cn("glass overflow-hidden rounded-xl", className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="h-2 w-2 bg-white/25" />
        <span className="h-2 w-2 bg-white/25" />
        <span className="h-2 w-2 bg-white/25" />
        <span className="ml-2 font-pixel text-[10px] text-subtle">~/doxed — zsh</span>
      </div>
      <div ref={box} className="h-[248px] overflow-hidden px-4 py-3 font-mono text-[12.5px] leading-[1.75]">
        {lines.map((l, i) => (
          <div key={i} className={l.t === "ok" ? "text-foreground" : l.t === "dim" ? "text-subtle" : "text-muted-foreground"}>
            {l.t === "cmd" ? (
              <>
                <span className="text-subtle">$ </span>
                <span className="text-foreground">{l.s}</span>
              </>
            ) : (
              l.s
            )}
          </div>
        ))}
        <div className="text-foreground">
          <span className="text-subtle">$ </span>
          {typing}
          <Cursor />
        </div>
      </div>
    </div>
  );
}

const EVENTS = [
  "LOCK_CREATED  ORBIT  41.0M → locked · 12mo",
  "DEV_DOXED     anon-K9m · private",
  "FEE_CLAIM     PAWS   2.34 SOL",
  "LAUNCH        SHIFT  pump.fun",
  "GRADUATED     HRBR   → raydium amm",
  "AI_SUMMARY    LGRL   refreshed",
  "REPO_SCAN     ORBIT  86/100",
  "DEV_DOXED     kitsune.dev · socials",
  "FEE_CLAIM     ORBIT  6.89 SOL",
];

/** Thin scrolling event log under the header. */
export function EventTicker() {
  const items = [...EVENTS, ...EVENTS];
  return (
    <div className="relative overflow-hidden border-b border-border bg-black/60 [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
      <div className="ticker flex w-max gap-10 py-1.5 font-mono text-[11px] text-subtle">
        {items.map((e, i) => (
          <span key={i} className="whitespace-pre">
            <span className="text-muted-foreground">[{String(12 + (i % 9)).padStart(2, "0")}:{String((i * 7) % 60).padStart(2, "0")}:{String((i * 13) % 60).padStart(2, "0")}]</span> {e}
          </span>
        ))}
      </div>
    </div>
  );
}
