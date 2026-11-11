// Collects hard facts about a GitHub repo for the AI code review.
import { env } from "../env";

const gh = async <T,>(path: string): Promise<T | null> => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "doxed-dev",
      ...(env.githubToken ? { authorization: `Bearer ${env.githubToken}` } : {}),
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
};

export function parseRepo(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i) ?? input.match(/^([\w.-]+)\/([\w.-]+)$/);
  return m ? `${m[1]}/${m[2].replace(/\.git$/, "")}` : null;
}

export type RepoFacts = {
  repo: string;
  stars: number;
  forks: number;
  isFork: boolean;
  createdAt: string;
  pushedAt: string;
  contributors: number;
  commits30d: number;
  lastCommit: string | null;
  languages: { name: string; pct: number }[];
  files: string[];
  readme: string;
  suspiciousFiles: string[];
};

export async function repoFacts(repo: string): Promise<RepoFacts | null> {
  const meta = await gh<{ stargazers_count: number; forks_count: number; fork: boolean; created_at: string; pushed_at: string; default_branch: string }>(`/repos/${repo}`);
  if (!meta) return null;
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [langs, contribs, commits, tree, readme] = await Promise.all([
    gh<Record<string, number>>(`/repos/${repo}/languages`),
    gh<unknown[]>(`/repos/${repo}/contributors?per_page=100&anon=1`),
    gh<{ commit: { author: { date: string } } }[]>(`/repos/${repo}/commits?per_page=100&since=${since}`),
    gh<{ tree: { path: string; type: string }[] }>(`/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`),
    gh<{ content: string }>(`/repos/${repo}/readme`),
  ]);
  const total = Object.values(langs ?? {}).reduce((a, b) => a + b, 0) || 1;
  const languages = Object.entries(langs ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, bytes]) => ({ name, pct: Math.round((bytes / total) * 100) }));
  const files = (tree?.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
  return {
    repo,
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    isFork: meta.fork,
    createdAt: meta.created_at,
    pushedAt: meta.pushed_at,
    contributors: contribs?.length ?? 0,
    commits30d: commits?.length ?? 0,
    lastCommit: commits?.[0]?.commit.author.date ?? meta.pushed_at,
    languages,
    files: files.slice(0, 400),
    readme: readme ? Buffer.from(readme.content, "base64").toString("utf8").slice(0, 6000) : "",
    suspiciousFiles: files.filter((f) => /(^|\/)(\.env(\..*)?|id_rsa|.*\.pem|.*keypair.*\.json)$/i.test(f) && !/example|sample/i.test(f)),
  };
}
