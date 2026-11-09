import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { schema } from './schema/index.js';

type Sql = ReturnType<typeof postgres>;

export type Database = PostgresJsDatabase<typeof schema>;

let sqlInstance: Sql | undefined;
let dbInstance: Database | undefined;

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set. Copy env.example to .env and configure the Postgres connection string.',
    );
  }
  return url;
}

export function getSql(): Sql {
  if (sqlInstance === undefined) {
    sqlInstance = postgres(resolveDatabaseUrl());
  }
  return sqlInstance;
}

export function getDb(): Database {
  if (dbInstance === undefined) {
    dbInstance = drizzle(getSql(), { schema });
  }
  return dbInstance;
}
