# Tech Opportunity Intelligence System (faindaGeeg)

A personal system to discover paid software-engineering opportunities and recurring, solvable problems from permitted public sources, following evidence of demand. It is intended to preserve source evidence, extract structured opportunities and problem signals, score them deterministically, and support lead follow-up. Phase 0 provides only the foundation: a running monorepo, an API and dashboard shell, and a Postgres database connection.

## Tech stack

- **Monorepo:** pnpm workspaces, TypeScript, ESLint, Prettier.
- **API (`apps/api`):** Fastify 5, Zod type provider, Swagger/OpenAPI UI.
- **Web (`apps/web`):** React 18, Vite, React Router, TanStack Query, Tailwind CSS.
- **Database (`packages/db`):** Drizzle ORM over PostgreSQL (pgvector image), via `postgres-js`.
- **AI:** OpenRouter is the planned first LLM provider behind a provider-independent layer. That layer is **not implemented** in Phase 0.

## Prerequisites

- Node.js >= 22 (see `.nvmrc`)
- pnpm 10.x (repo pins pnpm 10.33.3 via `packageManager`)
- Docker Desktop

## Setup

The environment template is named `env.example` (there is no `.env.example`).

```bash
cp env.example .env
```

Start Docker Desktop, then start Postgres and install/build:

```bash
docker compose up -d db
pnpm install
pnpm --filter @toi/db build
pnpm --filter @toi/db db:migrate
```

The Phase 0 schema is empty, so migrations create no tables yet. They exist to establish the migration path for Phase 1.

## Run the apps

Run each dev server in its own terminal:

```bash
pnpm --filter @toi/api dev
pnpm --filter @toi/web dev
```

- Web dashboard: http://localhost:5173
- API: http://localhost:3001
- OpenAPI UI: http://localhost:3001/docs

### Health endpoints

- `GET /health` — liveness; does not touch the database.
- `GET /health/db` — runs `select 1` through `@toi/db`; returns `503` when the database is unavailable.

## Configuration

Copy `env.example` to `.env`. Key variables:

- `DATABASE_URL` — matches the `db` service in `docker-compose.yml`.
- `API_PORT`, `API_HOST`, `API_AUTH_TOKEN` — API listener and an optional bearer-token guard (leave blank to run without auth).
- `WEB_PORT`, `VITE_API_BASE_URL` — web dev server and API base URL.
- `AI_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `EMBEDDINGS_PROVIDER` — reserved for later phases; not required in Phase 0.