import { runMigrations } from '@toi/db';

import { buildApp } from './app.js';
import { env } from './config/env.js';

async function main(): Promise<void> {
  if (env.DB_AUTO_MIGRATE) {
    console.log('Running database migrations…');
    try {
      await runMigrations();
      console.log('Database migrations complete.');
    } catch (error) {
      console.error('Database migration failed:', error);
      process.exit(1);
    }
  }

  const app = await buildApp();

  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }

  const baseUrl = `http://${env.API_HOST}:${env.API_PORT}`;
  app.log.info(`API listening at ${baseUrl}`);
  app.log.info(`OpenAPI docs available at ${baseUrl}/docs`);

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info(`Received ${signal}, shutting down gracefully`);
    try {
      await app.close();
      app.log.info('Server closed');
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((error: unknown) => {
  console.error('Fatal error during startup', error);
  process.exit(1);
});
