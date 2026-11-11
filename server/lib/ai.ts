// AI project summaries (from X + website + GitHub) and code reviews, via the Anthropic API.
import { env } from "../env";
import type { RepoFacts } from "./github";

async function claudeJson<T>(system: string, user: string): Promise<T> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.anthropicKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: env.aiModel, max_tokens: 1500, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = json.content.find((c) => c.type === "text")?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI returned no JSON");
  return JSON.parse(m[0]) as T;
}

/** Fetch a web page and reduce it to readable text. */
export async function pageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 doxed-dev-bot" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  } catch {
    return "";
  }
}

/** Recent posts from an X account (needs X_BEARER_TOKEN). */
export async function recentPosts(xUrl: string): Promise<{ at: string; text: string }[]> {
  if (!env.xBearer) return [];
  const handle = xUrl.split("/").filter(Boolean).pop()?.replace("@", "");
  if (!handle) return [];
  const h = { authorization: `Bearer ${env.xBearer}` };
  try {
    const u = await fetch(`https://api.x.com/2/users/by/username/${handle}`, { headers: h }).then((r) => r.json() as Promise<{ data?: { id: string } }>);
    if (!u.data) return [];
    const t = await fetch(`https://api.x.com/2/users/${u.data.id}/tweets?max_results=20&exclude=replies,retweets&tweet.fields=created_at`, { headers: h }).then(
      (r) => r.json() as Promise<{ data?: { text: string; created_at: string }[] }>,
    );
    return (t.data ?? []).map((x) => ({ at: x.created_at, text: x.text }));
  } catch {
    return [];
  }
}

export type SummaryOut = { tldr: string; points: string[]; recent: { at: string; text: string }[]; watchouts: string[] };

export async function summariseProject(input: {
  name: string;
  symbol: string;
  description?: string | null;
  website?: string;
  websiteText: string;
  posts: { at: string; text: string }[];
  readme?: string;
  disclosure: string;
}): Promise<SummaryOut> {
  const system = `You write neutral, plain-English research briefs about Solana tokens for retail holders.
Only use facts present in the sources. Never hype, never give financial advice, never invent numbers.
If sources are thin, say so in watchouts. Reply with ONLY a JSON object:
{"tldr": string (1-2 sentences: what it actually is),
 "points": string[] (2-4 concrete facts: product status, token utility, team/dev disclosure, traction),
 "recent": {"at": ISO date, "text": string}[] (up to 3 notable recent updates from the posts, newest first),
 "watchouts": string[] (0-3 honest caveats: unverified claims, missing code, concentration, etc.)}`;
  const user = `Token: ${input.name} ($${input.symbol})
Dev identity on Doxed Dev: verified, disclosure level "${input.disclosure}".
Launch description: ${input.description ?? "—"}

=== WEBSITE (${input.website ?? "none"}) ===
${input.websiteText || "(no website or unreadable)"}

=== RECENT X POSTS ===
${input.posts.map((p) => `[${p.at}] ${p.text}`).join("\n") || "(none available)"}

=== GITHUB README ===
${input.readme?.slice(0, 3000) || "(no repo linked)"}`;
  return claudeJson<SummaryOut>(system, user);
}

export type RepoReviewOut = { score: number; verdict: string; findings: { label: string; status: "good" | "warn" | "bad"; detail: string }[] };

export async function reviewRepo(f: RepoFacts): Promise<RepoReviewOut> {
  const system = `You are a senior engineer doing due diligence on a crypto project's GitHub repo for non-technical holders.
Judge: is this original, real, maintained code that matches what the README claims? Be fair and specific.
Reply with ONLY JSON: {"score": 0-100, "verdict": string (one sentence), "findings": [{"label": string (2-4 words), "status": "good"|"warn"|"bad", "detail": string (one sentence)}] (4-6 items covering originality, activity, tests/CI, secrets, security-relevant risks)}`;
  const user = JSON.stringify({
    repo: f.repo,
    stars: f.stars,
    forks: f.forks,
    isFork: f.isFork,
    createdAt: f.createdAt,
    lastCommit: f.lastCommit,
    contributors: f.contributors,
    commits30d: f.commits30d,
    languages: f.languages,
    suspiciousFiles: f.suspiciousFiles,
    hasTests: f.files.some((p) => /(^|\/)(tests?|__tests__|spec)(\/|$)|\.(test|spec)\.[jt]sx?$/i.test(p)),
    hasCI: f.files.some((p) => p.startsWith(".github/workflows/")),
    fileSample: f.files.slice(0, 150),
    readme: f.readme.slice(0, 4000),
  });
  const out = await claudeJson<RepoReviewOut>(system, user);
  out.score = Math.max(0, Math.min(100, Math.round(out.score)));
  return out;
}
