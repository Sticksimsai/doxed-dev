import { sql } from "../db";

export async function getSetting(key: string): Promise<string | null> {
  const [r] = await sql<{ value: string }[]>`select value from app_settings where key = ${key}`;
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await sql`insert into app_settings (key, value) values (${key}, ${value})
            on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
