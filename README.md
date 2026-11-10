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
pnpm --filter @toi/db db:seed
```

The API applies any unapplied migrations automatically on startup (`DB_AUTO_MIGRATE`, default true), so a fresh database — including one created after tearing down the Docker volume — is schema-ready on first boot; set `DB_AUTO_MIGRATE=false` to manage migrations manually, or run `pnpm --filter @toi/db db:migrate` yourself. `db:seed` idempotently inserts the 23 profile skills used for matching (run it after the schema exists).

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
- `EMBEDDINGS_PROVIDER` — embeddings backend for problem clustering: `local` (default), `openai`, or `huggingface`. See [Embeddings providers](#embeddings-providers).
- `EMBEDDING_DIM` — optional vector dimension for the local embedder (default 256) and, for OpenAI, an optional output truncation. Leaving it blank uses the provider/model default.
- `OPENAI_API_KEY` — required only when `EMBEDDINGS_PROVIDER=openai`; `OPENAI_EMBEDDINGS_MODEL` (default `text-embedding-3-small`).
- `HF_API_KEY` — required only when `EMBEDDINGS_PROVIDER=huggingface`; `HF_EMBEDDINGS_MODEL` (default `BAAI/bge-small-en-v1.5`).

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

Trigger a run from the **Sources** page (connector picker + max records) or via the API:

```bash
curl -X POST http://localhost:3001/api/ingestion/runs \
  -H 'content-type: application/json' \
  -d '{"sourceName":"Hacker News","maxRecords":25}'
```

The body is `{ sourceName?, maxRecords? }` (`sourceName` defaults to the configured source, `maxRecords` defaults to 25). `GET /api/ingestion/connectors` lists the registered connectors.

### Pull connectors

| `sourceName` | What it pulls | Config env |
| --- | --- | --- |
| `Hacker News` | Public Algolia API — zero config. | none |
| `Reddit` | Official OAuth (application-only, read-only). Register an app at https://www.reddit.com/prefs/apps (script/web type). | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` |
| `Stack Exchange` | Free Stack Exchange API — recent questions by tag. All vars optional. | `STACKEXCHANGE_SITE` (default `stackoverflow`), `STACKEXCHANGE_TAGS` (comma-separated, default `typescript,node.js,react,api`), `STACKEXCHANGE_KEY` (optional app key; raises the anonymous quota) |
| `Remotive` | Free Remotive remote-jobs API. Both vars optional. | `REMOTIVE_CATEGORY` (default `software-dev`), `REMOTIVE_SEARCH` (optional free-text search) |
| `RSS` | Generic RSS 2.0 / Atom — walks every configured feed across batches. Requires at least one feed URL. | `RSS_FEED_URLS` (comma-separated feed URLs; e.g. WeWorkRemotely programming RSS, subreddit RSS, Discourse/blog feeds) |
| `Google Sheets` | Durable CSV buffer — drains a sheet published to the web. | `GOOGLE_SHEETS_CSV_URL` |

Credentials are read from the environment only and are never stored in source config. For the Sheets buffer, the CSV columns are `externalId,url,title,content,author,publishedAt`; each run drains the whole sheet and downstream dedup by `externalId` prevents reprocessing.

### Push ingestion (webhooks) and the Google Sheets buffer

External automations (n8n, IFTTT) can **push** normalized records, and a
**Google Sheets** source can drain a published CSV — both for official-API or
authorized data only, no scraping. See
[docs/integrations/inbound-ingestion.md](docs/integrations/inbound-ingestion.md)
for the full contract, curl/n8n examples, and the Sheets buffer pattern.

- `POST /api/ingestion/inbound` — accept pushed records, authenticated with the
  `X-Webhook-Secret` header (`INGEST_WEBHOOK_SECRET`); returns `202` with
  `{ accepted, duplicates, runIds }`, `401` on a bad/missing secret, or `503`
  when disabled. Records are processed in the background.
- **Google Sheets** — set `GOOGLE_SHEETS_CSV_URL` to a sheet published to the web
  as CSV (columns `externalId,url,title,content,author,publishedAt`) and run the
  source from the Sources page or `POST /api/ingestion/runs {"sourceName":"Google Sheets"}`.

## Problem intelligence

After ingesting, build clusters of recurring problems from the **Problem Intelligence** page or via the API:

```bash
curl -X POST http://localhost:3001/api/problem-clusters/rebuild \
  -H 'content-type: application/json' \
  -d '{"similarityThreshold":0.45}'
```

Clusters group recurring problems and expose an independent-source count and a demand score. Open a cluster to see its evidence and members, then generate a draft service idea from it (`POST /api/problem-clusters/:id/service-ideas`). Service ideas are grounded hypotheses drawn from the evidence — drafts to validate, never proven demand.

Embeddings default to the built-in local embedder (no key). For higher-quality semantic clustering, set `EMBEDDINGS_PROVIDER=openai` and `OPENAI_API_KEY` in `.env` (or `huggingface` with `HF_API_KEY`).

### Embeddings providers

Embeddings are **provider-agnostic**, selected by `EMBEDDINGS_PROVIDER`:

- `local` (default) — a built-in deterministic hashing embedder. No API key, fully offline. Its similarity is approximate; use it for dev and key-less operation.
- `openai` — requires `OPENAI_API_KEY`. Optional `OPENAI_EMBEDDINGS_MODEL` (default `text-embedding-3-small`); `EMBEDDING_DIM` optionally reduces the output dimensions (OpenAI `text-embedding-3-*` support truncation).
- `huggingface` (or `hf`) — requires `HF_API_KEY` (`HF_EMBEDDINGS_MODEL`, default `BAAI/bge-small-en-v1.5`). The HuggingFace Inference API has a free tier.

A missing cloud key falls back to the local embedder.

The database embedding columns are **dimension-agnostic**, so any model's output size works.

Different providers/models produce different-dimension vectors that cannot be compared, so **switching the provider or model requires a one-time re-embed**: `POST /api/problem-clusters/rebuild {"reembed": true}` (or the Rebuild action on the **Problem Intelligence** page). This clears existing embeddings and clusters and rebuilds them with the current embedder.

## API endpoints

All under `/api` (see `/docs` for the OpenAPI spec):

- `POST /opportunities/submit` — submit raw text or a URL.
- `GET /opportunities` — list with filters (type, status, buying intent, min score, search) and pagination.
- `GET /opportunities/:id` — detail with evidence trail, score breakdown, and matched skills.
- `PATCH /opportunities/:id` — change status; `POST /opportunities/:id/feedback` — record relevance/notes.
- `POST /opportunities/:id/outreach-drafts` — generate an editable outreach draft; never sends.
- `GET/POST /leads`, `GET/PATCH /leads/:id`, `POST /leads/:id/activities` — lead tracking and outreach activities.
- `GET /skills`, `POST /skills`, `PATCH /skills/:id` — manage the skills profile.
- `GET /dashboard/summary` — totals and breakdowns.
- `GET /dashboard/digest` — daily digest: new opportunities, high-priority opportunities, and follow-ups due.
- `GET/POST /ingestion/runs` — list recent runs / trigger a run (`{ sourceName?, maxRecords? }`).
- `GET /sources` — list configured ingestion sources.
- `GET /ingestion/connectors` — list available connectors.
- `POST /ingestion/inbound` — accept pushed records from external automations (`X-Webhook-Secret` header; see [inbound ingestion](docs/integrations/inbound-ingestion.md)).
- `GET /problem-clusters` — list problem clusters by demand score.
- `GET /problem-clusters/:id` — cluster detail with evidence, members, and service ideas.
- `POST /problem-clusters/rebuild` — run an in-process clustering pass (`{ similarityThreshold?, reembed? }`); `reembed: true` clears embeddings and clusters first.
- `POST /problem-clusters/:id/service-ideas` — generate and save a draft service idea from a cluster.
- `GET /service-ideas` — list generated service ideas.

Outreach is draft-only and human-approved: the system suggests an editable message and never contacts anyone.

## Deploying (fly.io + Neon)

The API ships with a root `Dockerfile` and a `fly.toml`, so it can run as the
webhook receiver on [fly.io](https://fly.io) backed by
[Neon](https://neon.tech) Postgres.

1. Rename the `app` in `fly.toml` to your own globally-unique Fly app name.
2. Use a **Neon** Postgres connection string as `DATABASE_URL` (Neon supports
   pgvector). With `DB_AUTO_MIGRATE=true` (set in `fly.toml`) the schema is
   provisioned on the first boot.
3. Set secrets with `fly secrets set` (never commit them):

   ```bash
   fly secrets set \
     DATABASE_URL=... \
     INGEST_WEBHOOK_SECRET=... \
     OPENROUTER_API_KEY=... \
     OPENROUTER_MODEL=... \
     HF_API_KEY=...
   # optional:
   #   GOOGLE_SHEETS_CSV_URL=...   CORS_ORIGIN=...   API_AUTH_TOKEN=...
   ```

4. Deploy:

   ```bash
   fly deploy
   ```

Non-secret configuration (`API_HOST`, `API_PORT`, `NODE_ENV`, `DB_AUTO_MIGRATE`,
`AI_PROVIDER`, `EMBEDDINGS_PROVIDER`) lives in the `[env]` block of `fly.toml`.

## Running tests

```bash
pnpm --filter @toi/api test
```
