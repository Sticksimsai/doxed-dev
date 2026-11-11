// Hand-drawn 9×9 pixel icons. Same export names as the lucide icons they
// replace, so pages just import from here. '#' = filled pixel.
import type { CSSProperties } from "react";

type P = { className?: string; style?: CSSProperties; strokeWidth?: number; "aria-hidden"?: boolean };

function grid(rows: string[]) {
  return rows;
}
const flipV = (g: string[]) => [...g].reverse();
const flipH = (g: string[]) => g.map((r) => [...r].reverse().join(""));
const union = (a: string[], b: string[]) => a.map((r, y) => [...r].map((c, x) => (c === "#" || b[y][x] === "#" ? "#" : ".")).join(""));
const minus = (a: string[], b: string[]) => a.map((r, y) => [...r].map((c, x) => (c === "#" && b[y][x] !== "#" ? "#" : ".")).join(""));

export function Pixel({ rows, className, style }: { rows: string[] } & P) {
  const w = rows[0].length;
  const h = rows.length;
  let d = "";
  rows.forEach((r, y) => {
    let x = 0;
    while (x < w) {
      if (r[x] === "#") {
        let e = x;
        while (e < w && r[e] === "#") e++;
        d += `M${x} ${y}h${e - x}v1h-${e - x}z`;
        x = e;
      } else x++;
    }
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className ?? "h-4 w-4"} style={style} shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const make = (rows: string[]) => (p: P) => <Pixel rows={rows} {...p} />;

const ARROW_DOWN = grid(["....#....", "....#....", "....#....", "....#....", "#...#...#", ".#..#..#.", "..#.#.#..", "...###...", "....#...."]);
const ARROW_RIGHT = grid(["....#....", ".....#...", "......#..", ".......#.", "#########", ".......#.", "......#..", ".....#...", "....#...."]);
const SHIELD = grid([".#######.", "#########", "#########", "#########", "#########", ".#######.", ".#######.", "..#####..", "....#...."]);
const CHECK_HOLE = grid([".........", ".........", "......#..", ".....#...", "..#.#....", "...#.....", ".........", ".........", "........."]);
const EYE = grid([".........", "..#####..", ".#.....#.", "#..###..#", "#..###..#", ".#.....#.", "..#####..", ".........", "........."]);
const DIAG = grid(["........#", ".......#.", "......#..", ".....#...", "....#....", "...#.....", "..#......", ".#.......", "#........"]);

export const Check = make([".........", ".........", ".......##", "......##.", ".#...##..", ".##.##...", "..###....", "...#.....", "........."]);
export const CheckCircle2 = make(["#########", "#.......#", "#.....#.#", "#....#..#", "#.#.#...#", "#..#....#", "#.......#", "#.......#", "#########"]);
export const XCircle = make(["#########", "#.......#", "#.#...#.#", "#..#.#..#", "#...#...#", "#..#.#..#", "#.#...#.#", "#.......#", "#########"]);
export const CircleAlert = make(["#########", "#.......#", "#...#...#", "#...#...#", "#...#...#", "#.......#", "#...#...#", "#.......#", "#########"]);
export const AlertTriangle = make(["....#....", "...###...", "...#.#...", "..##.##..", "..#.#.#..", ".##.#.##.", ".#.....#.", "##..#..##", "#########"]);
export const ArrowDown = make(ARROW_DOWN);
export const ArrowUp = make(flipV(ARROW_DOWN));
export const ArrowRight = make(ARROW_RIGHT);
export const ArrowLeft = make(flipH(ARROW_RIGHT));
export const ChevronDown = make([".........", ".........", ".........", "#.......#", ".#.....#.", "..#...#..", "...#.#...", "....#....", "........."]);
export const ChevronsUpDown = make(["....#....", "...#.#...", "..#...#..", ".#.....#.", ".........", ".#.....#.", "..#...#..", "...#.#...", "....#...."]);
export const BarChart3 = make([".........", ".......#.", ".......#.", "....#..#.", "....#..#.", ".#..#..#.", ".#..#..#.", ".#..#..#.", "#########"]);
export const ChartNoAxesCombined = make([".......##", "......#..", ".#..##...", "#.##.....", ".........", "....#..#.", ".#..#..#.", ".#..#..#.", ".#..#..#."]);
export const Activity = make([".........", "....#....", "....#....", "...#.#...", "##.#.#.##", "..#...#..", "..#......", ".........", "........."]);
export const TrendingUp = make([".....####", "......###", ".....##.#", "#...##...", "##.##....", ".###.....", "..#......", ".........", "........."]);
export const BookOpen = make([".........", "##.....##", "#.##.##.#", "#..#.#..#", "#..#.#..#", "#..#.#..#", "#.##.##.#", "##..#..##", "........."]);
export const Code2 = make([".........", "#########", "#.......#", "#.#.....#", "#..#....#", "#.#.###.#", "#.......#", "#########", "........."]);
export const Coins = make(["..#####..", ".#.....#.", "#..###..#", "#..#....#", "#..###..#", "#....#..#", "#..###..#", ".#.....#.", "..#####.."]);
export const Copy = make(["..######.", "..#....#.", "######.#.", "#....#.#.", "#....#.#.", "#....###.", "#....#...", "######...", "........."]);
export const Droplets = make(["....#....", "...###...", "...###...", "..#####..", ".#######.", ".#.#####.", ".#######.", "..#####..", "...###..."]);
export const ExternalLink = make([".....####", "......###", ".....#.##", "#...#...#", "#..#.....", "#........", "#........", "#........", "######..."]);
export const Eye = make(EYE);
export const EyeOff = make(union(EYE, DIAG));
export const Fingerprint = make(["..#####..", ".#.....#.", "#..###..#", "#.#...#.#", "#.#.#.#.#", "#.#.#.#.#", "#...#.#.#", ".#.#..#..", "..#..#..."]);
export const Globe = make(["..#####..", ".#..#..#.", "#..#.#..#", "#########", "#..#.#..#", "#########", "#..#.#..#", ".#..#..#.", "..#####.."]);
export const ImagePlus = make(["#########", "#.......#", "#.##....#", "#.##....#", "#.....#.#", "#....####", "#..######", "#########", "........."]);
export const Layers = make(["....#....", "..##.##..", "##.....##", "..##.##..", "#...#...#", ".##...##.", "...###...", ".........", "........."]);
export const Loader2 = make(["...###...", ".#.....#.", ".........", "#.......#", "#.......#", "#.......#", ".........", ".#.......", "...#....."]);
export const Lock = make(["..#####..", ".##...##.", ".#.....#.", ".#.....#.", "#########", "####.####", "####.####", "#########", "#########"]);
export const PartyPopper = make(["#...#...#", ".#..#..#.", "..#...#..", ".........", "##.....##", ".........", "..#...#..", ".#..#..#.", "#...#...#"]);
export const RefreshCw = make(["..####.#.", ".#....##.", "#....###.", "#........", "#.......#", "........#", ".###....#", ".##....#.", ".#.####.."]);
export const Rocket = make(["....#....", "...###...", "...#.#...", "...###...", "...###...", "..#####..", ".##.#.##.", "#...#...#", "...#.#..."]);
export const ShieldCheck = make(minus(SHIELD, CHECK_HOLE));
export const BadgeCheck = ShieldCheck;
export const Sparkles = make(["....#....", "....#....", "..#####..", "....#....", "....#....", "......#..", ".....###.", "......#..", "........."]);
export const Star = make(["....#....", "....#....", "...###...", "#########", ".#######.", "..#####..", "..##.##..", ".##...##.", "##.....##"]);
export const UserRound = make(["...###...", "..#####..", "..#####..", "..#####..", "...###...", ".........", ".#######.", "#########", "#########"]);
export const Users = make([".##...##.", "####.####", "####.####", ".##...##.", ".........", "####.####", "####.####", "####.####", "........."]);
export const Zap = make([".....###.", "....###..", "...###...", "..######.", "....###..", "...###...", "..##.....", ".#.......", "........."]);
export const Search = make(["..####...", ".#....#..", "#......#.", "#......#.", "#......#.", ".#....#..", "..####.#.", ".......##", "........#"]);
export const Terminal = make(["#########", "#.......#", "#.#.....#", "#..#....#", "#.#.###.#", "#.......#", "#.......#", "#########", "........."]);

/** Doxed Dev logo: a pixel ID card (photo + data lines). */
export const DoxedMark = make([
  "###########",
  "#.........#",
  "#.###.###.#",
  "#.###.....#",
  "#.###.###.#",
  "#..#......#",
  "#.###.##..#",
  "#.........#",
  "###########",
]);

/** Deterministic 5×5 mirrored identicon for a token mint — replaces colour icons. */
export function Identicon({ seed, size = 40, className }: { seed: string; size?: number; className?: string }) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const rows: string[] = [];
  for (let y = 0; y < 5; y++) {
    const half: string[] = [];
    for (let x = 0; x < 3; x++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
      half.push(h % 100 < 52 ? "#" : ".");
    }
    rows.push([...half, half[1], half[0]].join(""));
  }
  if (!rows.join("").includes("#")) rows[2] = "..#..";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] ${className ?? ""}`}
      style={{ width: size, height: size, padding: size * 0.18 }}
      aria-hidden
    >
      <Pixel rows={rows} style={{ width: "100%", height: "100%" }} className="text-foreground" />
    </span>
  );
}
