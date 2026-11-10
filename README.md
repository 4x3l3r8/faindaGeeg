# Tech Opportunity Intelligence System (faindaGeeg)

A personal system to discover paid software-engineering opportunities and recurring, solvable problems from permitted public sources, following evidence of demand. It preserves source evidence, extracts structured opportunities, scores them deterministically, and supports lead follow-up. Phase 1 delivers core opportunity management: a manual submission pipeline, provider-independent AI extraction, a deterministic scoring service, a REST API, and a dashboard for reviewing opportunities and tracking leads.

## Tech stack

- **Monorepo:** pnpm workspaces, TypeScript, ESLint, Prettier.
- **API (`apps/api`):** Fastify 5, Zod type provider, Swagger/OpenAPI UI.
- **Web (`apps/web`):** React 18, Vite, React Router, TanStack Query, Tailwind CSS.
- **Database (`packages/db`):** Drizzle ORM over PostgreSQL (pgvector image), via `postgres-js`.
- **AI:** OpenRouter is the first LLM provider behind a provider-independent layer, with a deterministic offline mock provider for key-less dev and demos.

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
pnpm --filter @toi/db db:seed
```

The Phase 1 migration (`0000_known_tomas`) creates the ten Phase 1 tables. `db:seed` idempotently inserts the 23 profile skills used for matching.

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
- `AI_PROVIDER` — `openrouter` (default) or `mock`.
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` — required when `AI_PROVIDER=openrouter`. Set `AI_PROVIDER=mock` (or leave the key blank) to run fully offline with a deterministic mock extractor — handy for dev and demos, no API cost.
- `EMBEDDINGS_PROVIDER` — reserved for Phase 4 (semantic clustering); not used yet.

## Submitting an opportunity

Paste raw text or a URL on the **Opportunities** page, or call the API directly:

```bash
curl -X POST http://localhost:3001/api/opportunities/submit \
  -H 'content-type: application/json' \
  -d '{"text":"Looking to hire a freelance React/Node.js developer to build an internal dashboard."}'
```

The pipeline deduplicates by content hash, extracts a schema-validated opportunity, matches it against your skills, scores it, and links the supporting evidence. Irrelevant content and extraction failures are recorded but do not create an opportunity.

## Sources & ingestion

Ingestion pulls permitted public sources through connectors and processes each record with the same pipeline as manual submission. Dedup is by external id, runs resume from a saved cursor, per-record errors are isolated, and a `maxRecords` cap limits each run.

Hacker News works with **no configuration** — it uses the public Algolia API. Trigger a run from the **Sources** page (connector picker + max records) or via the API:

```bash
curl -X POST http://localhost:3001/api/ingestion/runs \
  -H 'content-type: application/json' \
  -d '{"sourceName":"hackernews","maxRecords":25}'
```

The body is `{ sourceName?, maxRecords? }` (`sourceName` defaults to the configured source, `maxRecords` defaults to 25).

To enable **Reddit**, register an app at https://www.reddit.com/prefs/apps (script/web type) and set the following in `.env`:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`

The connector uses the official OAuth application-only flow (`client_credentials`, read-only). Credentials are read from the environment only and are never stored in source config.

## API endpoints

All under `/api` (see `/docs` for the OpenAPI spec):

- `POST /opportunities/submit` — submit raw text or a URL.
- `GET /opportunities` — list with filters (type, status, buying intent, min score, search) and pagination.
- `GET /opportunities/:id` — detail with evidence trail, score breakdown, and matched skills.
- `PATCH /opportunities/:id` — change status; `POST /opportunities/:id/feedback` — record relevance/notes.
- `GET/POST /leads`, `GET/PATCH /leads/:id`, `POST /leads/:id/activities` — lead tracking and outreach activities.
- `GET /skills`, `POST /skills`, `PATCH /skills/:id` — manage the skills profile.
- `GET /dashboard/summary` — totals and breakdowns.
- `GET/POST /ingestion/runs` — list recent runs / trigger a run (`{ sourceName?, maxRecords? }`).
- `GET /sources` — list configured ingestion sources.
- `GET /ingestion/connectors` — list available connectors.

## Running tests

```bash
pnpm --filter @toi/api test
```