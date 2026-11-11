import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Code2, Coins, Lock, Zap } from "@/components/icons";
import { Cursor, Scramble } from "@/components/code-fx";
import { USE_MOCK } from "@/lib/api";
import { APP_NAME, SITE_URL } from "@/lib/brand";
import { cn } from "@/lib/format";

// Preview builds are hosted elsewhere — always show the real site's address there.
const origin = !USE_MOCK && typeof location !== "undefined" && location.protocol.startsWith("http") ? location.origin : SITE_URL;
const BASE = `${origin}/api/v1`;
const DATA = `${origin}/api`;
const M = "openai/gpt-5-mini";

type Method = "GET" | "POST";
type Param = { name: string; type: string; required?: boolean; desc: ReactNode };
type Endpoint = {
  id: string;
  method: Method;
  path: string;
  group: "gateway" | "data";
  auth: "key" | "public";
  title: string;
  summary: string;
  params?: Param[];
  paramsTitle?: string;
  notes?: ReactNode;
  examples: Record<string, string>;
};

const C = ({ children }: { children: ReactNode }) => <code className="rounded-[3px] bg-white/[0.06] px-1 py-0.5 font-mono text-[12.5px] text-foreground">{children}</code>;

const ENDPOINTS: Endpoint[] = [
  {
    id: "chat",
    method: "POST",
    path: "/v1/chat/completions",
    group: "gateway",
    auth: "key",
    title: "Create a chat completion",
    summary: "Generate a reply from any model. Supports streaming, tools, JSON output and images.",
    paramsTitle: "Body",
    params: [
      { name: "model", type: "string", required: true, desc: <>Model id from <C>/models</C>, e.g. <C>{M}</C></> },
      { name: "messages", type: "array", required: true, desc: <>List of <C>{"{ role, content }"}</C> — system, user, assistant, tool</> },
      { name: "stream", type: "boolean", desc: "Stream tokens as server-sent events" },
      { name: "max_tokens", type: "number", desc: "Output cap — clamped to 8,192" },
      { name: "temperature", type: "number", desc: "0–2. Lower = more focused" },
      { name: "tools", type: "array", desc: "Functions the model may call" },
      { name: "tool_choice", type: "string | object", desc: <><C>auto</C>, <C>none</C>, or force one tool</> },
      { name: "response_format", type: "object", desc: <><C>json_object</C> or a JSON schema</> },
      { name: "models", type: "string[]", desc: "Fallback models, tried in order" },
      { name: "stop · seed · top_p", type: "mixed", desc: "Stop sequences, reproducible sampling, nucleus sampling" },
    ],
    notes: (
      <>
        <C>usage.cost</C> in the response is what the call took from your monthly credit (USD).
      </>
    ),
    examples: {
      Request: `curl ${BASE}/chat/completions \\
  -H "Authorization: Bearer $DOXED_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${M}",
    "messages": [
      { "role": "user", "content": "Explain bonding curves in one line." }
    ]
  }'`,
      Response: `{
  "id": "dxd-1731321112-AbC",
  "object": "chat.completion",
  "model": "${M}",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Price rises automatically as supply is bought."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 11,
    "total_tokens": 25,
    "cost": 0.000041
  }
}`,
      Stream: `# add "stream": true — you get server-sent events:

data: {"id":"dxd-…","choices":[{"delta":{"content":"Price"}}]}
data: {"id":"dxd-…","choices":[{"delta":{"content":" rises"}}]}
…
data: {"id":"dxd-…","choices":[],"usage":{"cost":0.000041,…}}
data: [DONE]`,
    },
  },
  {
    id: "models",
    method: "GET",
    path: "/v1/models",
    group: "gateway",
    auth: "public",
    title: "List models",
    summary: "Every model you can call, with context size, price per token and supported features.",
    params: [
      { name: "id", type: "string", desc: "Pass this as model" },
      { name: "context_length", type: "number", desc: "Max tokens in + out" },
      { name: "pricing", type: "object", desc: "USD per prompt / completion token" },
      { name: "input_modalities", type: "string[]", desc: <>Includes <C>image</C> for vision models</> },
      { name: "supported_parameters", type: "string[]", desc: <>e.g. <C>tools</C>, <C>response_format</C></> },
    ],
    paramsTitle: "Each model has",
    examples: {
      Request: `curl ${BASE}/models`,
      Response: `{
  "object": "list",
  "data": [
    {
      "id": "${M}",
      "owned_by": "openai",
      "context_length": 400000,
      "pricing": { "prompt": "0.00000025", "completion": "0.000002" },
      "input_modalities": ["text", "image"],
      "supported_parameters": ["tools", "response_format", "…"]
    }
  ]
}
// example values — always read live data`,
    },
  },
  {
    id: "key",
    method: "GET",
    path: "/v1/key",
    group: "gateway",
    auth: "key",
    title: "Check credit",
    summary: "Remaining monthly credit for the key's owner — useful for degrading gracefully near the limit.",
    params: [
      { name: "credit_usd", type: "number", desc: "Your monthly compute credit" },
      { name: "spent_usd", type: "number", desc: "Used so far this month" },
      { name: "remaining_usd", type: "number", desc: "What's left until the 1st" },
      { name: "key_limit_usd", type: "number | null", desc: "Optional cap on this key" },
      { name: "rpm", type: "number", desc: "Requests per minute allowed" },
    ],
    paramsTitle: "Returns",
    examples: {
      Request: `curl ${BASE}/key \\
  -H "Authorization: Bearer $DOXED_API_KEY"`,
      Response: `{
  "data": {
    "credit_usd": 100,
    "spent_usd": 12.84,
    "remaining_usd": 87.16,
    "key_limit_usd": null,
    "rpm": 60
  }
}`,
    },
  },
  {
    id: "tokens",
    method: "GET",
    path: "/tokens",
    group: "data",
    auth: "public",
    title: "List tokens",
    summary: "Every listed doxed token with its dev — market data, lock, fee claims, AI summary and code review.",
    params: [
      { name: "tokens[]", type: "Token[]", desc: "Sorted by market cap" },
      { name: "devs[]", type: "Dev[]", desc: "Public profiles of the devs behind them" },
    ],
    paramsTitle: "Returns",
    examples: {
      Request: `curl ${DATA}/tokens`,
      Response: `{
  "tokens": [
    {
      "mint": "dyXg…jiBP",
      "symbol": "ORBIT",
      "mcap": 4820000,
      "volume24h": 2950000,
      "holders": 15314,
      "change": { "5m": 0.4, "1h": 2.1, "6h": 5.8, "24h": 3.6 },
      "lock": { "pctOfDevAllocation": 100, "unlocksAt": "2027-10-21T…" },
      "devId": "d1",
      …
    }
  ],
  "devs": [ { "id": "d1", "alias": "orbitlabs", "disclosure": "public", … } ]
}`,
    },
  },
  {
    id: "token",
    method: "GET",
    path: "/tokens/:mint",
    group: "data",
    auth: "public",
    title: "Get a token",
    summary: "One token and its dev. The richest object — perfect context for a community bot.",
    params: [
      { name: "mint", type: "path", required: true, desc: "Token mint address" },
      { name: "token.lock", type: "object", desc: "Locked amount, unlock date, contract" },
      { name: "token.feeClaims", type: "array", desc: "Every creator-fee claim with its transaction" },
      { name: "token.ai", type: "object", desc: "Plain-English summary, recent updates, watch-outs" },
      { name: "token.repo", type: "object", desc: "Code review score and findings (if GitHub linked)" },
      { name: "dev", type: "Dev", desc: "Checks passed, disclosure, stats" },
    ],
    examples: {
      Request: `curl ${DATA}/tokens/<MINT>`,
      Response: `{
  "token": {
    "symbol": "ORBIT",
    "lock": { "amount": 41000000, "unlocksAt": "2027-10-21T…" },
    "feeClaims": [ { "at": "…", "amountSol": 6.89, "signature": "…" } ],
    "ai": { "tldr": "Toolkit for AI trading agents…", "watchouts": ["…"] },
    "repo": { "score": 86, "findings": [ … ] }
  },
  "dev": {
    "alias": "orbitlabs",
    "disclosure": "public",
    "checks": { "identity": true, "liveness": true, "wallet": true }
  }
}`,
    },
  },
  {
    id: "dev",
    method: "GET",
    path: "/devs/:id",
    group: "data",
    auth: "public",
    title: "Get a dev",
    summary: "A dev's public profile, which checks they passed, their track record and all their launches.",
    params: [
      { name: "id", type: "path", required: true, desc: "Dev id (from a token's devId)" },
      { name: "dev.stats", type: "object", desc: "Launches, locks honoured / broken, fees claimed" },
      { name: "tokens", type: "Token[]", desc: "Everything they launched here" },
    ],
    examples: {
      Request: `curl ${DATA}/devs/<DEV_ID>`,
      Response: `{
  "dev": {
    "alias": "orbitlabs",
    "disclosure": "public",
    "revealed": { "name": "…", "x": "orbitlabs_sol" },
    "stats": { "launches": 2, "locksHonored": 2, "locksBroken": 0 }
  },
  "tokens": [ … ]
}`,
    },
  },
  {
    id: "launchpads",
    method: "GET",
    path: "/launchpads",
    group: "data",
    auth: "public",
    title: "List launchpads",
    summary: "Launchpads a token can be created on, and where each graduates to.",
    examples: {
      Request: `curl ${DATA}/launchpads`,
      Response: `[
  { "id": "pumpfun", "name": "Pump.fun", "graduatesTo": "PumpSwap", "available": true },
  { "id": "bonk", "name": "LetsBonk", "graduatesTo": "Raydium AMM", "available": true },
  …
]`,
    },
  },
];

const INTEGRATIONS: { name: string; kind: string; code: string }[] = [
  {
    name: "OpenAI SDK",
    kind: "SDK · JS & Python",
    code: `// npm i openai
import OpenAI from "openai";
const ai = new OpenAI({ apiKey: process.env.DOXED_API_KEY, baseURL: "${BASE}" });

# pip install openai
from openai import OpenAI
ai = OpenAI(api_key=os.environ["DOXED_API_KEY"], base_url="${BASE}")`,
  },
  {
    name: "Vercel AI SDK",
    kind: "Framework · TypeScript",
    code: `// npm i ai @ai-sdk/openai
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const doxed = createOpenAI({ baseURL: "${BASE}", apiKey: process.env.DOXED_API_KEY });

const { text } = await generateText({
  model: doxed.chat("${M}"),   // use .chat() — this is a Chat Completions endpoint
  prompt: "Summarise today's holder questions",
});`,
  },
  {
    name: "LangChain",
    kind: "Framework · JS & Python",
    code: `// npm i @langchain/openai
import { ChatOpenAI } from "@langchain/openai";
const llm = new ChatOpenAI({
  model: "${M}",
  apiKey: process.env.DOXED_API_KEY,
  configuration: { baseURL: "${BASE}" },
});

# pip install langchain-openai
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="${M}", api_key=os.environ["DOXED_API_KEY"], base_url="${BASE}")`,
  },
  {
    name: "LlamaIndex",
    kind: "Framework · Python",
    code: `# pip install llama-index-llms-openai-like
from llama_index.llms.openai_like import OpenAILike

llm = OpenAILike(
    model="${M}",
    api_base="${BASE}",
    api_key=os.environ["DOXED_API_KEY"],
    is_chat_model=True,
)`,
  },
  {
    name: "Telegram bot",
    kind: "Bot · grammY",
    code: `// npm i grammy openai
import { Bot } from "grammy";
import OpenAI from "openai";

const MINT = "<your token mint>";
const ai = new OpenAI({ apiKey: process.env.DOXED_API_KEY, baseURL: "${BASE}" });
const bot = new Bot(process.env.TELEGRAM_TOKEN!);

bot.on("message:text", async (ctx) => {
  const { token, dev } = await fetch("${DATA}/tokens/" + MINT).then((r) => r.json());
  const res = await ai.chat.completions.create({
    model: "${M}",
    messages: [
      { role: "system", content: \`Community bot for $\${token.symbol}. Facts: \${JSON.stringify({ token, dev })}\` },
      { role: "user", content: ctx.message.text },
    ],
  });
  await ctx.reply(res.choices[0].message.content ?? "");
});
bot.start();`,
  },
  {
    name: "Discord bot",
    kind: "Bot · discord.js",
    code: `// npm i discord.js openai
import { Client, GatewayIntentBits } from "discord.js";
import OpenAI from "openai";

const ai = new OpenAI({ apiKey: process.env.DOXED_API_KEY, baseURL: "${BASE}" });
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on("messageCreate", async (m) => {
  if (m.author.bot || !m.content.startsWith("!ask ")) return;
  const res = await ai.chat.completions.create({
    model: "${M}",
    messages: [{ role: "user", content: m.content.slice(5) }],
  });
  await m.reply(res.choices[0].message.content ?? "");
});
client.login(process.env.DISCORD_TOKEN);`,
  },
  {
    name: "n8n · Make · Zapier",
    kind: "No-code",
    code: `n8n
  Credentials → OpenAI
    API Key:  dxd_…
    Base URL: ${BASE}
  Then use the OpenAI / AI Agent nodes as normal.

Make · Zapier · Pipedream
  Add an HTTP request step:
    POST    ${BASE}/chat/completions
    Header  Authorization: Bearer dxd_…
    Body    {"model":"${M}","messages":[{"role":"user","content":"{{input}}"}]}`,
  },
  {
    name: "Agents & editors",
    kind: "Any OpenAI-compatible tool",
    code: `AI agent frameworks — pick the "OpenAI" / "OpenAI-compatible" provider:
  OPENAI_API_KEY=dxd_…
  OPENAI_BASE_URL=${BASE}

Code editors & assistants with a custom OpenAI endpoint setting:
  Base URL  ${BASE}
  API key   dxd_…
  Model     any id from /models`,
  },
];

const FEATURES: Record<string, string> = {
  "Tool calling": `const res = await ai.chat.completions.create({
  model: "${M}",
  messages: [{ role: "user", content: "What's ORBIT's market cap?" }],
  tools: [{
    type: "function",
    function: {
      name: "get_token",
      description: "Look up a Doxed token",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string" } },
        required: ["symbol"],
      },
    },
  }],
});

const call = res.choices[0].message.tool_calls?.[0];
// run get_token(JSON.parse(call.function.arguments)),
// then send the result back as a { role: "tool" } message`,
  "JSON output": `const res = await ai.chat.completions.create({
  model: "${M}",
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "sentiment",
      strict: true,
      schema: {
        type: "object",
        properties: {
          score: { type: "number" },
          label: { type: "string", enum: ["bull", "bear", "neutral"] },
        },
        required: ["score", "label"],
        additionalProperties: false,
      },
    },
  },
  messages: [{ role: "user", content: "Rate: 'dev locked 100% for 2 years'" }],
});

JSON.parse(res.choices[0].message.content!); // { score: 0.9, label: "bull" }`,
  Streaming: `const stream = await ai.chat.completions.create({
  model: "${M}",
  messages: [{ role: "user", content: "Write a launch-day thread" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`,
  Vision: `const res = await ai.chat.completions.create({
  model: "${M}", // needs "image" in input_modalities
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Is this chart bullish? One sentence." },
      { type: "image_url", image_url: { url: "https://…/chart.png" } },
    ],
  }],
});`,
  Fallbacks: `await ai.chat.completions.create({
  model: "${M}",
  // tried in order if the first is down or rate-limited
  // @ts-expect-error extra field
  models: ["${M}", "google/gemini-2.5-flash"],
  messages: [{ role: "user", content: "gm" }],
});`,
};

const TOC: [string, string][] = [
  ["start", "Get started"],
  ["endpoints", "Endpoints"],
  ...ENDPOINTS.map((e) => [e.id, e.path] as [string, string]),
  ["features", "Features"],
  ["integrations", "Integrations"],
  ["usecases", "What to build"],
  ["errors", "Errors"],
  ["limits", "Limits"],
];

export function BuilderDocsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/builder" className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Builder dashboard
      </Link>

      <header className="mt-4 mb-10">
        <div className="inline-flex items-center gap-2 rounded-[4px] border border-border-strong px-2 py-1 font-pixel text-[10px] uppercase text-muted-foreground">
          API reference · v1
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
          <Scramble text="Builder API docs" />
          <Cursor />
        </h1>
        <p className="font-prose mt-3 max-w-2xl text-muted-foreground">
          One OpenAI-compatible endpoint for hundreds of AI models, plus a public data API for every doxed token. Free for doxed devs —
          up to <b className="text-foreground">$100 of compute every month</b>.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <ol className="sticky top-32 space-y-0.5 border-l border-border text-[13px]">
            {TOC.map(([id, label]) => {
              const ep = ENDPOINTS.find((e) => e.id === id);
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={cn("-ml-px flex items-center gap-2 border-l border-transparent py-1 hover:border-foreground hover:text-foreground", ep ? "pl-5 text-subtle" : "pl-3 text-muted-foreground")}
                  >
                    {ep && <MethodPill method={ep.method} tiny />}
                    <span className="truncate">{label}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <article className="min-w-0 space-y-16">
          {/* ---------- get started */}
          <section id="start" className="scroll-mt-32 space-y-4">
            <H2>Get started</H2>
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCard icon={<Code2 />} label="Base URL" value={BASE.replace(/^https?:\/\//, "")} copy={BASE} />
              <InfoCard icon={<Lock />} label="Auth header" value="Bearer dxd_…" copy="Authorization: Bearer dxd_" />
              <InfoCard icon={<Coins />} label="Free compute" value="$100 / month" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["1", "Get doxed", "Scan your ID once — keys are for verified devs."],
                ["2", "Create a key", "On the Builder dashboard. Shown once — store it in an env var."],
                ["3", "Point your SDK here", "Swap the base URL + key in any OpenAI-compatible client."],
              ].map(([n, t, d]) => (
                <div key={n} className="card flex gap-3 p-4">
                  <span className="font-pixel text-[11px] text-subtle">0{n}</span>
                  <div>
                    <div className="text-sm font-medium">{t}</div>
                    <p className="font-prose mt-0.5 text-sm text-muted-foreground">{d}</p>
                  </div>
                </div>
              ))}
            </div>
            <CodeTabs
              tabs={{
                JavaScript: `import OpenAI from "openai";

const ai = new OpenAI({
  apiKey: process.env.DOXED_API_KEY,   // dxd_…
  baseURL: "${BASE}",
});

const res = await ai.chat.completions.create({
  model: "${M}",
  messages: [{ role: "user", content: "gm" }],
});
console.log(res.choices[0].message.content);`,
                Python: `import os
from openai import OpenAI

ai = OpenAI(api_key=os.environ["DOXED_API_KEY"], base_url="${BASE}")

res = ai.chat.completions.create(
    model="${M}",
    messages=[{"role": "user", "content": "gm"}],
)
print(res.choices[0].message.content)`,
                cURL: `curl ${BASE}/chat/completions \\
  -H "Authorization: Bearer $DOXED_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${M}","messages":[{"role":"user","content":"gm"}]}'`,
              }}
            />
            <p className="font-prose rounded-md border border-dashed border-border-strong p-3 text-sm text-muted-foreground">
              Keep keys server-side. Never put them in a website, app bundle or public repo — anyone with the key spends your credit.
              Leaked one? Revoke it on the dashboard and make a new one.
            </p>
          </section>

          {/* ---------- endpoint overview */}
          <section id="endpoints" className="scroll-mt-32 space-y-6">
            <H2>Endpoints</H2>
            {(["gateway", "data"] as const).map((g) => (
              <div key={g}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <div className="shrink-0 font-display text-lg font-medium">{g === "gateway" ? "AI gateway" : "Doxed Data API"}</div>
                  <code className="min-w-0 truncate font-mono text-xs text-subtle">{g === "gateway" ? `${origin}/api` : DATA}</code>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                    <a key={e.id} href={`#${e.id}`} className="card group flex flex-col gap-2 p-4 transition hover:-translate-y-0.5 hover:border-foreground/40">
                      <div className="flex items-center justify-between gap-2">
                        <MethodPill method={e.method} />
                        <AuthChip auth={e.auth} />
                      </div>
                      <code className="font-mono text-[13px] text-foreground">{e.path}</code>
                      <p className="font-prose line-clamp-2 text-xs text-muted-foreground">{e.summary}</p>
                      <span className="mt-auto inline-flex items-center gap-1 text-xs text-subtle group-hover:text-foreground">
                        Details <ArrowRight className="h-3 w-3" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* ---------- endpoint cards */}
          <div className="space-y-6">
            {ENDPOINTS.map((e) => (
              <EndpointCard key={e.id} e={e} />
            ))}
          </div>

          {/* ---------- features */}
          <section id="features" className="scroll-mt-32 space-y-4">
            <H2>Features</H2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              {[
                ["Streaming", "Token-by-token replies"],
                ["Tool calling", "Let models call your functions"],
                ["JSON output", "Strict schemas, parse-safe"],
                ["Vision", "Send images & charts"],
                ["Fallbacks", "Auto-switch if a model is down"],
              ].map(([t, d]) => (
                <div key={t} className="card p-3">
                  <Zap className="h-3.5 w-3.5" />
                  <div className="mt-2 text-sm font-medium">{t}</div>
                  <div className="font-prose text-xs text-muted-foreground">{d}</div>
                </div>
              ))}
            </div>
            <CodeTabs tabs={FEATURES} />
            <p className="font-prose text-sm text-muted-foreground">
              Support varies by model — check <C>supported_parameters</C> and <C>input_modalities</C> in <C>/models</C>.
            </p>
          </section>

          <Integrations />

          {/* ---------- use cases */}
          <section id="usecases" className="scroll-mt-32 space-y-4">
            <H2>What to build</H2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Community bot", "Answers holder questions with live Doxed data — lock dates, fee claims, market cap."],
                ["Trading & agent bots", "Read the market, explain moves, post updates — with tools and JSON output."],
                ["Launch content", "Threads, announcements and changelogs drafted from your commits or roadmap."],
                ["Holder support", "FAQ answers, scam-report triage, chat summaries for mods."],
                ["Analytics digests", "Daily plain-English summaries of on-chain data and token feeds."],
                ["Games & utility", "NPC dialogue, quests and in-game helpers for tokens with real products."],
              ].map(([t, d]) => (
                <div key={t} className="card p-4">
                  <div className="font-display text-base font-medium">{t}</div>
                  <p className="font-prose mt-1 text-sm text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {[
                ["High-volume chat", "mini / flash models"],
                ["Reasoning & writing", "flagship models"],
                ["Code", "coding-tuned models"],
                ["Images & charts", "models with image input"],
              ].map(([need, pick]) => (
                <div key={need} className="rounded-lg border border-border p-3 text-sm">
                  <div className="eyebrow">{need}</div>
                  <div className="mt-1">→ {pick}</div>
                </div>
              ))}
            </div>
            <p className="font-prose text-sm text-muted-foreground">
              Model ids change as new versions ship — always pick from <C>GET /models</C>.
            </p>
          </section>

          {/* ---------- errors */}
          <section id="errors" className="scroll-mt-32 space-y-4">
            <H2>Errors</H2>
            <p className="font-prose text-sm text-muted-foreground">OpenAI-shaped, so SDKs surface the message as-is:</p>
            <Code>{`{ "error": { "message": "Monthly credit of $100.00 used up. It resets on the 1st.", "type": "insufficient_quota", "code": "insufficient_quota" } }`}</Code>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["400", "invalid_request_error", "Bad body, missing or disallowed model"],
                ["401", "invalid_api_key", "Missing, wrong or revoked key"],
                ["402", "insufficient_quota", "Monthly credit or key cap used up"],
                ["403", "forbidden", "Not doxed, or account flagged"],
                ["429", "rate_limited", "Too many requests — back off and retry"],
                ["502", "upstream_error", "Model unavailable — retry or add fallbacks"],
              ].map(([s, c, d]) => (
                <div key={s} className="card flex gap-3 p-4">
                  <span className={cn("font-mono text-2xl font-medium", s.startsWith("5") ? "text-danger" : s === "402" || s === "429" ? "text-foreground" : "text-muted-foreground")}>{s}</span>
                  <div className="min-w-0">
                    <code className="break-all font-mono text-xs text-foreground">{c}</code>
                    <p className="font-prose text-xs text-muted-foreground">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ---------- limits */}
          <section id="limits" className="scroll-mt-32 space-y-4">
            <H2>Limits</H2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["$100", "compute / month", "resets on the 1st (UTC)"],
                ["5", "active keys", "per dev"],
                ["60", "requests / min", "per key"],
                ["8,192", "output tokens", "per request"],
              ].map(([v, l, s]) => (
                <div key={l} className="card p-4">
                  <div className="font-mono text-2xl font-medium">{v}</div>
                  <div className="text-sm">{l}</div>
                  <div className="text-xs text-subtle">{s}</div>
                </div>
              ))}
            </div>
            <p className="font-prose text-sm text-muted-foreground">
              Covered by {APP_NAME}'s launch fees — you never pay for compute. Need more for a live product? Reach out on X.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ building blocks
function EndpointCard({ e }: { e: Endpoint }) {
  const full = `${e.group === "gateway" ? `${origin}/api` : DATA}${e.path}`;
  return (
    <section id={e.id} className="card scroll-mt-32 overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <MethodPill method={e.method} />
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground sm:text-[15px]">{e.path}</code>
        <AuthChip auth={e.auth} />
        <CopyBtn value={full} label="URL" />
      </header>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <h3 className="font-display text-xl font-medium">{e.title}</h3>
            <p className="font-prose mt-1 text-sm text-muted-foreground">{e.summary}</p>
          </div>
          {e.params && (
            <div>
              <div className="eyebrow mb-2">{e.paramsTitle ?? "Parameters"}</div>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {e.params.map((p) => (
                  <li key={p.name} className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-[13px] text-foreground">{p.name}</code>
                      <span className="font-mono text-[11px] text-subtle">{p.type}</span>
                      {p.required && <span className="rounded-[3px] border border-foreground/40 px-1 font-pixel text-[9px] uppercase text-foreground">required</span>}
                    </div>
                    <div className="font-prose mt-0.5 text-sm text-muted-foreground">{p.desc}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {e.notes && <p className="font-prose text-sm text-muted-foreground">{e.notes}</p>}
        </div>
        <div className="min-w-0 border-t border-border bg-black/30 p-3 sm:p-4 xl:border-t-0 xl:border-l">
          <CodeTabs tabs={e.examples} compact />
        </div>
      </div>
    </section>
  );
}

function Integrations() {
  const [sel, setSel] = useState(INTEGRATIONS[0].name);
  const cur = INTEGRATIONS.find((i) => i.name === sel)!;
  return (
    <section id="integrations" className="scroll-mt-32 space-y-4">
      <H2>Integrations</H2>
      <p className="font-prose text-sm text-muted-foreground">Anything that lets you set a custom OpenAI base URL works. Pick yours:</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {INTEGRATIONS.map((i) => (
          <button
            key={i.name}
            onClick={() => setSel(i.name)}
            aria-pressed={sel === i.name}
            className={cn("rounded-lg border p-3 text-left transition", sel === i.name ? "border-foreground/60 bg-foreground/5" : "border-border bg-card hover:border-border-strong")}
          >
            <div className="text-sm font-medium">{i.name}</div>
            <div className="font-pixel text-[9px] uppercase text-subtle">{i.kind}</div>
          </button>
        ))}
      </div>
      <Code>{cur.code}</Code>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="eyebrow mb-1">Supported</div>
          <div className="text-sm">Chat Completions · streaming · tools · JSON schema · vision input · fallbacks</div>
        </div>
        <div className="rounded-lg border border-dashed border-border p-3">
          <div className="eyebrow mb-1">Coming later</div>
          <div className="text-sm text-muted-foreground">Responses API · embeddings · image generation · audio</div>
        </div>
      </div>
    </section>
  );
}

function MethodPill({ method, tiny }: { method: Method; tiny?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[3px] font-pixel uppercase",
        tiny ? "w-8 py-px text-[8px]" : "w-12 py-0.5 text-[10px]",
        method === "POST" ? "bg-foreground text-background" : "border border-foreground/50 text-foreground",
      )}
    >
      {method}
    </span>
  );
}

function AuthChip({ auth }: { auth: "key" | "public" }) {
  return (
    <span className={cn("chip shrink-0 font-pixel text-[9px] uppercase", auth === "key" ? "border-border-strong text-muted-foreground" : "border-dashed border-border-strong text-subtle")}>
      {auth === "key" && <Lock className="h-2.5 w-2.5" />}
      {auth === "key" ? "API key" : "Public"}
    </span>
  );
}

function InfoCard({ icon, label, value, copy }: { icon: ReactNode; label: string; value: string; copy?: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-strong [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="eyebrow">{label}</div>
        <div className="truncate font-mono text-sm">{value}</div>
      </div>
      {copy && <CopyBtn value={copy} />}
    </div>
  );
}

const H2 = ({ children }: { children: ReactNode }) => <h2 className="font-display text-2xl font-medium">{children}</h2>;

function Code({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-black/50 p-4 pr-12 font-mono text-[12.5px] leading-relaxed text-muted-foreground">{children}</pre>
      <div className="absolute top-2 right-2">
        <CopyBtn value={children} />
      </div>
    </div>
  );
}

function CodeTabs({ tabs, compact }: { tabs: Record<string, string>; compact?: boolean }) {
  const names = Object.keys(tabs);
  const [t, setT] = useState(names[0]);
  return (
    <div className={cn("overflow-hidden", compact ? "" : "rounded-lg border border-border")}>
      <div className={cn("flex items-center gap-1 overflow-x-auto [scrollbar-width:none]", compact ? "mb-2" : "border-b border-border bg-white/[0.02] p-1")}>
        {names.map((n) => (
          <button
            key={n}
            onClick={() => setT(n)}
            className={cn("shrink-0 whitespace-nowrap rounded px-2.5 py-1 text-xs", t === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
          >
            {n}
          </button>
        ))}
        <span className="ml-auto pl-2">
          <CopyBtn value={tabs[t]} />
        </span>
      </div>
      <pre
        className={cn(
          "overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-muted-foreground",
          compact ? "max-h-[440px] overflow-y-auto rounded-md border border-border bg-black/50 p-3" : "bg-black/50 p-4",
        )}
      >
        {tabs[t]}
      </pre>
    </div>
  );
}

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn-ghost shrink-0 !px-2 !py-1 text-xs"
      title="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1400);
      }}
    >
      {ok ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label && <span>{ok ? "Copied" : label}</span>}
    </button>
  );
}
