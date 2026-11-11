import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, Copy } from "@/components/icons";
import { Cursor, Scramble } from "@/components/code-fx";
import { APP_NAME, SITE_URL } from "@/lib/brand";
import { cn } from "@/lib/format";

const origin = typeof location !== "undefined" && location.protocol.startsWith("http") ? location.origin : SITE_URL;
const BASE = `${origin}/api/v1`;
const DATA = `${origin}/api`;
const M = "openai/gpt-5-mini";

const TOC = [
  ["overview", "Overview"],
  ["auth", "Authentication"],
  ["quickstart", "Quick start"],
  ["chat", "POST /chat/completions"],
  ["models", "GET /models"],
  ["key", "GET /key"],
  ["data", "Doxed Data API"],
  ["features", "Streaming, tools, JSON, vision"],
  ["integrations", "Integrations"],
  ["usecases", "What to build"],
  ["choosing", "Choosing a model"],
  ["errors", "Errors"],
  ["limits", "Limits & credit"],
] as const;

export function BuilderDocsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/builder" className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Builder dashboard
      </Link>
      <header className="mt-4 mb-8">
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

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <ol className="sticky top-32 space-y-1 border-l border-border text-sm">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-subtle hover:border-foreground hover:text-foreground">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 space-y-14">
          <Section id="overview" title="Overview">
            <P>
              The Builder API speaks the OpenAI Chat Completions format, so anything that works with OpenAI works here — just change
              the base URL and the key.
            </P>
            <Table
              head={["", ""]}
              rows={[
                ["Base URL", <Code key="b">{BASE}</Code>],
                ["Auth", <Code key="a">Authorization: Bearer dxd_…</Code>],
                ["Format", "OpenAI Chat Completions (JSON, SSE streaming)"],
                ["Models", "Hundreds — GPT, Claude, Gemini, Llama, DeepSeek, Qwen, Mistral and more"],
                ["Who", "Doxed devs. Keys stop working if a dev is flagged."],
                ["Price", "Free — up to $100 of compute per dev per month"],
              ]}
            />
          </Section>

          <Section id="auth" title="Authentication">
            <P>
              Create keys on the{" "}
              <Link to="/builder" className="underline decoration-dotted underline-offset-4">
                Builder dashboard
              </Link>
              . Keys start with <Code>dxd_</Code>, are shown once, and can be revoked instantly. Send them as a Bearer token.
            </P>
            <Callout>
              Keep keys on your server or in environment variables. Never ship them in a website, mobile app or public repo — anyone
              with the key spends your credit. If one leaks, revoke it and create a new one.
            </Callout>
          </Section>

          <Section id="quickstart" title="Quick start">
            <Tabs
              tabs={{
                JavaScript: `npm i openai

import OpenAI from "openai";

const ai = new OpenAI({
  apiKey: process.env.DOXED_API_KEY,
  baseURL: "${BASE}",
});

const res = await ai.chat.completions.create({
  model: "${M}",
  messages: [{ role: "user", content: "Explain bonding curves in one line." }],
});
console.log(res.choices[0].message.content);`,
                Python: `pip install openai

import os
from openai import OpenAI

ai = OpenAI(api_key=os.environ["DOXED_API_KEY"], base_url="${BASE}")
res = ai.chat.completions.create(
    model="${M}",
    messages=[{"role": "user", "content": "Explain bonding curves in one line."}],
)
print(res.choices[0].message.content)`,
                cURL: `curl ${BASE}/chat/completions \\
  -H "Authorization: Bearer $DOXED_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${M}","messages":[{"role":"user","content":"gm"}]}'`,
              }}
            />
          </Section>

          <Section id="chat" title="POST /chat/completions" badge="POST">
            <P>Generate a reply from any model. Request body:</P>
            <Table
              head={["Field", "Type", "Notes"]}
              rows={[
                [<Code key="1">model</Code>, "string", <>Required. A model id from <Code>/models</Code>, e.g. <Code>{M}</Code>.</>],
                [<Code key="2">messages</Code>, "array", <>Required. <Code>{"{ role, content }"}</Code> — roles: system, user, assistant, tool.</>],
                [<Code key="3">stream</Code>, "boolean", "Stream tokens as server-sent events."],
                [<Code key="4">max_tokens</Code>, "number", "Output cap. Clamped to the platform maximum (8,192 by default)."],
                [<Code key="5">temperature · top_p</Code>, "number", "Sampling controls."],
                [<Code key="6">tools · tool_choice</Code>, "array · string|object", "Function calling (models that support it)."],
                [<Code key="7">response_format</Code>, "object", <><Code>{`{"type":"json_object"}`}</Code> or a JSON schema for structured output.</>],
                [<Code key="8">stop · seed</Code>, "string[] · number", "Stop sequences, reproducible sampling."],
                [<Code key="9">presence_penalty · frequency_penalty</Code>, "number", "Repetition controls."],
                [<Code key="10">models</Code>, "string[]", "Optional fallback list — tried in order if the first model is down."],
              ]}
            />
            <P>Response:</P>
            <Pre>{`{
  "id": "dxd-1731321112-AbC…",
  "object": "chat.completion",
  "model": "${M}",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "A price that rises as supply is bought…" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 14, "completion_tokens": 22, "total_tokens": 36, "cost": 0.000041 }
}`}</Pre>
            <P>
              <Code>usage.cost</Code> is what the call took from your monthly credit, in USD.
            </P>
          </Section>

          <Section id="models" title="GET /models" badge="GET">
            <P>Every model you can use, with context length, price per token and what it accepts.</P>
            <Pre>{`curl ${BASE}/models

// example output — values vary by model
{ "object": "list", "data": [
  { "id": "${M}", "owned_by": "openai", "context_length": 400000,
    "pricing": { "prompt": "0.00000025", "completion": "0.000002" },
    "input_modalities": ["text", "image"], "supported_parameters": ["tools", "response_format", …] },
  …
]}`}</Pre>
          </Section>

          <Section id="key" title="GET /key" badge="GET">
            <P>Check remaining credit from your code — handy for degrading gracefully near the limit.</P>
            <Pre>{`curl ${BASE}/key -H "Authorization: Bearer $DOXED_API_KEY"

{ "data": { "credit_usd": 100, "spent_usd": 12.84, "remaining_usd": 87.16, "key_limit_usd": null, "rpm": 60 } }`}</Pre>
          </Section>

          <Section id="data" title="Doxed Data API" badge="PUBLIC">
            <P>
              Read-only platform data — no key needed. Combine it with the model endpoint to build bots that actually know your token.
            </P>
            <Table
              head={["Endpoint", "Returns"]}
              rows={[
                [<Code key="1">GET /api/tokens</Code>, "Every listed token + its dev (market data, lock, fee claims, AI summary, code review)"],
                [<Code key="2">GET /api/tokens/:mint</Code>, "One token and its dev"],
                [<Code key="3">GET /api/devs/:id</Code>, "A dev's public profile, checks passed, stats and launches"],
                [<Code key="4">GET /api/launchpads</Code>, "Supported launchpads"],
              ]}
            />
            <Pre>{`curl ${DATA}/tokens/<MINT>

{ "token": { "symbol": "ORBIT", "mcap": 4820000, "holders": 15314,
    "lock": { "pctOfDevAllocation": 100, "unlocksAt": "2027-10-21T…" },
    "feeClaims": [ … ], "ai": { "tldr": "…", "watchouts": [ … ] } },
  "dev": { "alias": "orbitlabs", "disclosure": "public", "checks": { "identity": true, … } } }`}</Pre>
            <P>Data refreshes every minute. Please cache on your side and keep it under ~1 request/second.</P>
          </Section>

          <Section id="features" title="Streaming, tools, JSON, vision">
            <Tabs
              tabs={{
                Streaming: `const stream = await ai.chat.completions.create({
  model: "${M}",
  messages: [{ role: "user", content: "Write a launch-day thread" }],
  stream: true,
});
for await (const chunk of stream) process.stdout.write(chunk.choices[0]?.delta?.content ?? "");

// Raw SSE:  data: {"choices":[{"delta":{"content":"gm"}}]} … data: [DONE]
// The last chunk carries "usage" with the cost.`,
                "Tool calling": `const res = await ai.chat.completions.create({
  model: "${M}",
  messages: [{ role: "user", content: "What's ORBIT's market cap?" }],
  tools: [{
    type: "function",
    function: {
      name: "get_token",
      description: "Look up a Doxed token",
      parameters: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] },
    },
  }],
});
const call = res.choices[0].message.tool_calls?.[0];
// → run get_token(JSON.parse(call.function.arguments)), send the result back as a "tool" message`,
                "JSON output": `const res = await ai.chat.completions.create({
  model: "${M}",
  response_format: {
    type: "json_schema",
    json_schema: { name: "sentiment", strict: true, schema: {
      type: "object",
      properties: { score: { type: "number" }, label: { type: "string", enum: ["bull", "bear", "neutral"] } },
      required: ["score", "label"], additionalProperties: false,
    }},
  },
  messages: [{ role: "user", content: "Rate this tweet: 'dev just locked 100% for 2 years 🔒'" }],
});
JSON.parse(res.choices[0].message.content!);  // { score: 0.9, label: "bull" }`,
                Vision: `const res = await ai.chat.completions.create({
  model: "${M}",   // pick a model whose input_modalities include "image"
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Is this chart bullish? One sentence." },
      { type: "image_url", image_url: { url: "https://…/chart.png" } },
    ],
  }],
});`,
                Fallbacks: `// If the first model is down or rate-limited, the next one is tried automatically.
await ai.chat.completions.create({
  model: "${M}",
  // @ts-expect-error extra field
  models: ["${M}", "google/gemini-2.5-flash"],
  messages: [{ role: "user", content: "gm" }],
});`,
              }}
            />
            <P>Support for tools, JSON schema and images depends on the model — check its <Code>supported_parameters</Code> and <Code>input_modalities</Code> in <Code>/models</Code>.</P>
          </Section>

          <Section id="integrations" title="Integrations">
            <P>Anything that lets you set a custom OpenAI base URL works. Common setups:</P>
            <Tabs
              tabs={{
                "Vercel AI SDK": `npm i ai @ai-sdk/openai

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const doxed = createOpenAI({ baseURL: "${BASE}", apiKey: process.env.DOXED_API_KEY });

const { text } = await generateText({
  model: doxed.chat("${M}"),   // use .chat() — the endpoint is Chat Completions
  prompt: "Summarise today's holder questions",
});`,
                "LangChain (JS)": `npm i @langchain/openai

import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  model: "${M}",
  apiKey: process.env.DOXED_API_KEY,
  configuration: { baseURL: "${BASE}" },
});
const msg = await llm.invoke("gm");`,
                "LangChain (Py)": `pip install langchain-openai

from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="${M}", api_key=os.environ["DOXED_API_KEY"], base_url="${BASE}")
llm.invoke("gm")`,
                LlamaIndex: `pip install llama-index-llms-openai-like

from llama_index.llms.openai_like import OpenAILike
llm = OpenAILike(model="${M}", api_base="${BASE}",
                 api_key=os.environ["DOXED_API_KEY"], is_chat_model=True)`,
                "Telegram bot": `npm i grammy openai

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
      { role: "system", content: \`You are the community bot for $\${token.symbol}. Only use these facts:
\${JSON.stringify({ token, dev })}\` },
      { role: "user", content: ctx.message.text },
    ],
  });
  await ctx.reply(res.choices[0].message.content ?? "");
});
bot.start();`,
                "Discord bot": `npm i discord.js openai

import { Client, GatewayIntentBits } from "discord.js";
import OpenAI from "openai";

const ai = new OpenAI({ apiKey: process.env.DOXED_API_KEY, baseURL: "${BASE}" });
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on("messageCreate", async (m) => {
  if (m.author.bot || !m.content.startsWith("!ask ")) return;
  const res = await ai.chat.completions.create({ model: "${M}", messages: [{ role: "user", content: m.content.slice(5) }] });
  await m.reply(res.choices[0].message.content ?? "");
});
client.login(process.env.DISCORD_TOKEN);`,
                "No-code (n8n, Make)": `n8n
  Credentials → OpenAI → API Key: dxd_…  ·  Base URL: ${BASE}
  Then use the OpenAI / AI Agent nodes as normal.

Make, Zapier, Pipedream & others
  Use an HTTP request step:
    POST ${BASE}/chat/completions
    Header  Authorization: Bearer dxd_…
    Body    {"model":"${M}","messages":[{"role":"user","content":"{{input}}"}]}`,
                "Agents & editors": `AI agent frameworks (crypto agents, autonomous bots, etc.)
  Pick the "OpenAI" or "OpenAI-compatible" provider and set:
    OPENAI_API_KEY=dxd_…
    OPENAI_BASE_URL=${BASE}

Code editors & assistants with a custom OpenAI endpoint setting
  Base URL: ${BASE}    API key: dxd_…    Model: any id from /models`,
              }}
            />
            <Table
              head={["Supported", "Not yet"]}
              rows={[["Chat Completions · streaming · tools · JSON mode/schema · vision input · model fallbacks", "Responses API · embeddings · image generation · audio"]]}
            />
          </Section>

          <Section id="usecases" title="What to build">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Community bot", "Telegram/Discord bot that answers holder questions using live Doxed data — lock dates, fee claims, market cap."],
                ["Trading & agent bots", "Let an agent read the market, explain its moves, and post updates — with tool calling and JSON output."],
                ["Launch content", "Draft threads, announcements and changelogs from your commits or roadmap."],
                ["Holder support", "Answer FAQs, triage scam reports, and summarise long chats for mods."],
                ["Analytics digests", "Turn on-chain data and Doxed token feeds into daily plain-English summaries."],
                ["Games & utility", "NPC dialogue, quests and in-game helpers for tokens with real products."],
              ].map(([t, d]) => (
                <div key={t} className="card p-4">
                  <div className="font-display text-base font-medium">{t}</div>
                  <p className="font-prose mt-1 text-sm text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="choosing" title="Choosing a model">
            <Table
              head={["You want", "Look for", "Why"]}
              rows={[
                ["Chat bots, high volume", "small / mini / flash models", "Fast and cheap — your $100 goes a very long way"],
                ["Reasoning, analysis, writing", "flagship models", "Better answers; costs more per token"],
                ["Code generation", "coding-tuned models", "Stronger at tools and long context"],
                ["Reading images & charts", <><Code key="i">input_modalities</Code> includes image</>, "Needed for vision prompts"],
              ]}
            />
            <P>
              Model ids change as new versions ship — always pick from <Code>GET /models</Code>. Prices there are USD per token.
            </P>
          </Section>

          <Section id="errors" title="Errors">
            <P>Errors use the OpenAI shape, so SDKs raise them with the message intact:</P>
            <Pre>{`{ "error": { "message": "Monthly credit of $100.00 used up. It resets on the 1st.", "type": "insufficient_quota", "code": "insufficient_quota" } }`}</Pre>
            <Table
              head={["Status", "code", "Meaning"]}
              rows={[
                ["400", "invalid_request_error · model_not_allowed", "Bad body, missing model, or model not enabled"],
                ["401", "invalid_api_key", "Missing, wrong or revoked key"],
                ["402", "insufficient_quota", "Monthly credit (or this key's cap) used up"],
                ["403", "forbidden", "Dev not doxed, or account flagged"],
                ["429", "rate_limited", "Over the per-key request rate — back off and retry"],
                ["502 / 503", "upstream_error · not_configured", "Model temporarily unavailable — retry, or pass a fallback list in models"],
              ]}
            />
          </Section>

          <Section id="limits" title="Limits & credit">
            <Table
              head={["Limit", "Value"]}
              rows={[
                ["Monthly compute credit", "Up to $100 per dev (resets on the 1st, UTC)"],
                ["Keys per dev", "5 active"],
                ["Rate", "60 requests / minute per key"],
                ["Output per request", "8,192 tokens max"],
                ["Billing", "Pay nothing — usage is covered by the platform's launch fees"],
              ]}
            />
            <P>
              Need more for a live product? Reach out on X — {APP_NAME} raises limits for builders with real traction.
            </P>
          </Section>
        </article>
      </div>
    </div>
  );
}

function Section({ id, title, badge, children }: { id: string; title: string; badge?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 space-y-4">
      <h2 className="flex items-center gap-2 font-display text-2xl font-medium">
        {badge && <span className="rounded-[4px] border border-border-strong px-1.5 py-0.5 font-pixel text-[10px] text-muted-foreground">{badge}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="font-prose text-[15px] leading-relaxed text-muted-foreground">{children}</p>;
const Code = ({ children }: { children: ReactNode }) => <code className="rounded-[3px] bg-white/[0.06] px-1 py-0.5 font-mono text-[12.5px] text-foreground">{children}</code>;

function Callout({ children }: { children: ReactNode }) {
  return <div className="font-prose rounded-md border border-dashed border-border-strong p-3 text-sm text-muted-foreground">{children}</div>;
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const showHead = head.some(Boolean);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        {showHead && (
          <thead className="bg-white/[0.03] font-pixel text-[10px] uppercase text-subtle">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border first:border-t-0">
              {r.map((c, j) => (
                <td key={j} className={cn("px-3 py-2 align-top", j === 0 ? "whitespace-nowrap text-foreground" : "font-prose text-muted-foreground")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-border bg-black/50 p-4 font-mono text-[12.5px] leading-relaxed text-muted-foreground">{children}</pre>
      <div className="absolute top-2 right-2">
        <CopyBtn value={children} />
      </div>
    </div>
  );
}

function Tabs({ tabs }: { tabs: Record<string, string> }) {
  const names = Object.keys(tabs);
  const [t, setT] = useState(names[0]);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex overflow-x-auto border-b border-border bg-white/[0.02] [scrollbar-width:none]">
        {names.map((n) => (
          <button
            key={n}
            onClick={() => setT(n)}
            className={cn("shrink-0 whitespace-nowrap px-3 py-2 text-xs", t === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="overflow-x-auto bg-black/50 p-4 font-mono text-[12.5px] leading-relaxed text-muted-foreground">{tabs[t]}</pre>
        <div className="absolute top-2 right-2">
          <CopyBtn value={tabs[t]} />
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn-ghost !px-2 !py-1 text-xs"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1400);
      }}
    >
      {ok ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
