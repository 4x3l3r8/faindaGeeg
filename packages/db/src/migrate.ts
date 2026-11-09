import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { getDb } from './client.js';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

async function main(): Promise<void> {
  console.log(`Applying migrations from ${migrationsFolder} ...`);
  await migrate(getDb(), { migrationsFolder });
}

main()
  .then(() => {
    console.log('Migrations applied successfully.');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
