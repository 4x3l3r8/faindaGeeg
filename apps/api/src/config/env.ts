import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const moduleDir = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(moduleDir, '../../../../.env') });

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.string().min(1).default('info'),
  DATABASE_URL: z.string().url(),
  API_AUTH_TOKEN: optionalString,
  OPENROUTER_API_KEY: optionalString,
  OPENROUTER_MODEL: optionalString,
  OPENAI_API_KEY: optionalString,
  EMBEDDINGS_PROVIDER: optionalString,
  AI_PROVIDER: z.string().min(1).default('openrouter'),
  REDDIT_CLIENT_ID: optionalString,
  REDDIT_CLIENT_SECRET: optionalString,
  REDDIT_USER_AGENT: optionalString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${details}`);
  console.error('See env.example for the expected variables.');
  process.exit(1);
}

export const env = Object.freeze(parsed.data);

export type Env = typeof env;
