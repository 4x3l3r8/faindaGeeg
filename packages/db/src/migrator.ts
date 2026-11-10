import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set. Copy env.example to .env and configure the Postgres connection string.',
    );
  }
  return url;
}

export async function runMigrations(databaseUrl?: string): Promise<{ applied: boolean }> {
  const url = resolveDatabaseUrl(databaseUrl);
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  const journalPath = fileURLToPath(new URL('../drizzle/meta/_journal.json', import.meta.url));

  if (!existsSync(journalPath)) {
    console.log('No migrations found; nothing to apply.');
    return { applied: false };
  }

  const sql = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(sql), { migrationsFolder });
    return { applied: true };
  } finally {
    await sql.end();
  }
}
