import { sql } from 'drizzle-orm';

import { getDb } from './client.js';

export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const startedAt = Date.now();
  await getDb().execute(sql`select 1`);
  const latencyMs = Date.now() - startedAt;
  return { ok: true, latencyMs };
}
