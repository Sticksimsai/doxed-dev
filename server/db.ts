import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env, requireDb } from "./env";

export const sql = postgres(requireDb(), {
  max: 10,
  idle_timeout: 30,
  ssl: env.databaseUrl.includes("localhost") || env.databaseUrl.includes("127.0.0.1") ? false : "prefer",
  onnotice: () => {},
});

/** Runs server/migrations/*.sql in order, once each. */
export async function migrate() {
  await sql`create table if not exists schema_migrations (name text primary key, ran_at timestamptz not null default now())`;
  const dir = join(import.meta.dirname, "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const body = readFileSync(join(dir, f), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${f})`;
    });
    console.log(`[db] migrated ${f}`);
  }
}
