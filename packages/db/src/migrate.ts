import { runMigrations } from './migrator.js';

async function main(): Promise<void> {
  console.log('Applying migrations ...');
  const { applied } = await runMigrations();
  if (applied) {
    console.log('Migrations applied successfully.');
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
