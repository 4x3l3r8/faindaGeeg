import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { getDb, getSql } from './client.js';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const journalPath = fileURLToPath(new URL('../drizzle/meta/_journal.json', import.meta.url));

async function main(): Promise<void> {
  // Phase 0 / fresh repo: no migrations have been generated yet. Drizzle's
  // migrator throws if the journal is missing, so treat that as a clean no-op.
  if (!existsSync(journalPath)) {
    console.log('No migrations found; nothing to apply.');
    return;
  }

  console.log(`Applying migrations from ${migrationsFolder} ...`);
  await migrate(getDb(), { migrationsFolder });
  console.log('Migrations applied successfully.');

  // Only reached when a connection was actually opened above.
  await getSql().end();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
