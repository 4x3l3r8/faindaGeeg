# Progress Log

Living log of implementation status. Newest entries first.

## 2026-11-10 — Inbound push ingestion, Google Sheets buffer, and fly.io/Neon deployment

- **Inbound webhook.** `POST /api/ingestion/inbound` accepts pushed records from external automations (n8n/IFTTT), authenticated with the `X-Webhook-Secret` header (`INGEST_WEBHOOK_SECRET`). Accepts a single record, a bare array, or `{ records: [...] }` (max 50); `202 { accepted, duplicates, runIds }`, `401` on a bad secret, `503` when disabled. Dedup is per-source by `externalId` (falls back to content hash); records are persisted and processed in the background. See `docs/integrations/inbound-ingestion.md`.
- **Google Sheets buffer source.** A `Google Sheets` connector drains a sheet published to the web as CSV (`GOOGLE_SHEETS_CSV_URL`; columns `externalId,url,title,content,author,publishedAt`) — durable buffer that survives app downtime. Listed alongside Hacker News and Reddit.
- **Deployment.** Added a root `Dockerfile` (pnpm workspace build; runs `apps/api/dist/index.js`) and `fly.toml` (Fly app, HTTP service on 8080, non-secret `[env]`). Deploy targets fly.io + Neon Postgres; `DB_AUTO_MIGRATE=true` provisions the schema on boot.
- **Verified locally (2026-11-10):** webhook auth/dedup/batch behavior, Google Sheets CSV parsing, and the Docker image booting, auto-migrating, and serving.

## 2026-11-10 — Embeddings made fully provider-agnostic

- `ai/embeddings.ts` now selects a backend by `EMBEDDINGS_PROVIDER`: `local` (default, no key, approximate hashing), `openai` (`OPENAI_API_KEY`, optional `OPENAI_EMBEDDINGS_MODEL` / `EMBEDDING_DIM` truncation), or `huggingface` (`HF_API_KEY`, `HF_EMBEDDINGS_MODEL`). A missing cloud key falls back to local.
- The embedding columns are now dimensionless (Drizzle `customType`), so any model's output size fits without a schema migration.
- Because vector spaces/dimensions differ, switching provider or model requires a rebuild with `reembed: true` (`POST /api/problem-clusters/rebuild {"reembed": true}`), which clears existing embeddings and clusters first. See ADR 0002.

## 2026-11-10 — Phase 4 — problem intelligence completed

### Completed

- **Schema.** Added `opportunities.embedding` and three tables: `problem_clusters` (normalized `centroid`, member/demand/independent-source metrics, and a validation status), `cluster_members`, and `service_ideas`. Migration `0002_faithful_namor` enables the pgvector extension (`CREATE EXTENSION IF NOT EXISTS vector`). The embedding columns are dimensionless (a Drizzle `customType`), so any embedder's output size fits.
- **Embeddings (`ai/embeddings.ts`).** A fully provider-agnostic layer — `LocalEmbedder` (default, no key, approximate hashing), `OpenAIEmbedder`, and `HuggingFaceEmbedder` — selected by `EMBEDDINGS_PROVIDER` (`local` | `openai` | `huggingface`), with a local fallback when a cloud key is missing.
- **Clustering (`modules/clusters`).** In-process `runClustering`: batch-embed opportunities missing an embedding, then greedily assign each unclustered opportunity to its nearest cluster via pgvector cosine distance (similarity threshold default 0.45), creating a new cluster otherwise. The centroid is recomputed as the normalized mean of member embeddings, and metrics are recomputed (`member_count`, distinct-author `independent_source_count`, `demand_score`, first/last observed timestamps).
- **Service ideas (`ai/service-ideas.ts`).** An AI generator that turns a cluster into one draft service (summary, target customer, suggested service, required skills, engagement model, validation questions, next action). Zod-validated behind a v1 injection-safe prompt that treats evidence as untrusted data, stays grounded, and never claims proven demand. A mock path keeps it working offline.
- **REST.** `GET /api/problem-clusters`, `GET /api/problem-clusters/:id`, `POST /api/problem-clusters/rebuild`, `POST /api/problem-clusters/:id/service-ideas`, `GET /api/service-ideas`.
- **UI.** A **Problem Intelligence** page (rebuild trigger, cluster list with demand/independent-source counts, and a detail view with evidence, members, and potential services) and a **Service Ideas** page.
- **Fixes made this phase.** Source records now persist `authorKey` + `publishedAt`, which feed independent-source counts and freshness scoring.

### Verified (2026-11-10)

- A live run ingested 20 Hacker News records and clustered them into groups (top cluster: 12 members / 12 independent authors / demand 100).
- Service-idea generation and persistence were verified, and the UI was verified in the browser.
- 49 Vitest tests pass, including 16 new tests.
- With the local embedder, clustering quality is approximate; OpenAI embeddings improve it.

### Next milestone

Phase 5: optimisation (scoring calibration from feedback/outcomes, source performance, better ranking, notifications, analytics).

## 2026-11-10 — Phase 3 — lead management (outreach drafts + daily digest) completed

### Completed

- **Lead tracking core (Phase 1).** Lead status, notes, follow-up dates, and outreach activities already shipped in Phase 1. Phase 3 adds the AI outreach-draft generator and the daily digest on top of that core.
- **Plain-text generation.** `AiProvider.generateText` added to the provider layer: OpenRouter returns plain text, and the offline `MockProvider` returns a deterministic draft for key-less dev and demos.
- **Draft-only outreach (`ai/outreach.ts`).** Generates a concise outreach message behind a v1 injection-safe prompt that treats the opportunity text as untrusted data, references genuinely relevant skills, asks exactly one clarifying question, uses a `[your name]` sign-off placeholder, and never fabricates the recipient, budget, or links. It only drafts — it never sends.
- **Outreach route.** `POST /api/opportunities/:id/outreach-drafts` returns an editable draft (draft-only).
- **Daily digest.** `getDailyDigest` plus `GET /api/dashboard/digest`: new opportunities (last N hours, default 24), high-priority opportunities (score >= 80 with status `new` or `reviewing`), and leads whose follow-ups are due (`next_action_at` within 24h), each with a count.
- **UI.** Opportunity detail gains an "Outreach draft" card (generate → edit → copy, with a draft-only note); the dashboard gains a "Today's digest" card.

### Verified (2026-11-10)

- The outreach and digest endpoints were verified over HTTP.
- The UI was verified in the browser: the digest card renders and a draft generates into an editable textarea.
- 33 Vitest tests pass, including 7 new outreach tests.
- The system never auto-contacts anyone: outreach is draft-only and human-approved.

### Next milestone

Phase 4: problem intelligence (embeddings, clustering, service ideas).

## 2026-11-10 — Phase 2 ingestion engine completed

### Completed

- **Ingestion schema.** `ingestion_runs` table plus migration `0001` (`0001_third_master_chief`): run status, counts, error, a resumable cursor, and a source link. Indexed on source and creation time.
- **Shared processing.** A single `processSourceRecord()` reused by both manual submission and ingestion, so extracted opportunities follow one code path.
- **Connector interface.** `ISourceConnector` with `RawSourceRecord` / `IngestionBatch` / `IngestionCursor` types, giving the engine a uniform contract for sources.
- **Hacker News connector.** Uses the public Algolia API — no auth, zero config.
- **Reddit connector.** Uses the official OAuth application-only flow (`client_credentials`, read-only). Credentials come from env only (`REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USER_AGENT`), never from source config.
- **Run orchestration (in-process, no Redis).** Dedup by external id, cursor resume across runs, per-record error isolation, a `maxRecords` cap, and connector health via `last_successful_sync_at`.
- **REST routes.** `GET/POST /api/ingestion/runs`, `GET /api/sources`, `GET /api/ingestion/connectors`.
- **Sources page.** Feed health, a run trigger (connector picker + max records), and a recent-runs table.

### Verified (2026-11-10)

- Live Hacker News ingestion created scored opportunities from real posts.
- The UI trigger worked end-to-end.
- The cursor resumed across runs.
- 26 Vitest tests pass, including Hacker News normalization and run dedup/idempotency.
- Reddit needs credentials to run.

### Next milestone

Phase 3: outreach drafting and a daily opportunity digest (lead tracking core already shipped in Phase 1). Then Phase 4 (problem intelligence).

## 2026-11-10 — Phase 1 core opportunity management completed

### Completed

- **Database.** Full Phase 1 Drizzle schema (10 tables with relations) and applied migration `0000_known_tomas`, plus an idempotent skills seed of 23 profile skills (`pnpm --filter @toi/db db:seed`).
- **AI layer.** Provider-independent extraction: an OpenRouter adapter and a deterministic offline `MockProvider`, a versioned (`v1`) injection-resistant extraction prompt, and Zod-validated output. Invalid output raises `ExtractionValidationError`, which routes the submission to manual review.
- **Scoring.** Deterministic lead scoring with 25/25/20/10/10/10 weights (skill fit, buying intent, commercial value, urgency, freshness, credibility), a configurable per-type freshness half-life, per-factor explanations plus a `missingEvidence` list, reproducible results, and score version `v1`.
- **Submission pipeline.** Manual text or URL submission: HTML-to-text, sha256 content-hash dedup, source-record creation, AI extraction, skill matching, scoring, and a single transactional persist. Returns a discriminated result: `created`, `duplicate`, `irrelevant`, or `needs_review`.
- **REST API** under `/api`: opportunity submit, list, detail, status, and feedback; leads CRUD plus activities; skills list/create/update; dashboard summary — with Zod validation and OpenAPI at `/docs`.
- **Frontend.** Dashboard summary; opportunity inbox with submission form and filters; opportunity detail with evidence trail, full score explanation, matched skills, and actions; skills profile; leads/CRM master-detail with outreach activities.

### Verified (2026-11-10)

- All packages typecheck and build.
- 20 Vitest unit tests pass (scoring, skill matching, extraction).
- Full browser walkthrough verified end-to-end: submit -> scored opportunity with 6 matched skills and evidence -> promote to lead -> status change -> activity logged, plus dedup and irrelevant-rejection.
- All 15 MVP acceptance criteria are met.

### Next milestone

Phase 2: ingestion engine plus the first permitted public source.

## 2026-11-09 — Phase 0 scaffolding completed

### Completed

- Root pnpm workspace, pinned pnpm 10.33.3, Node >= 22, TypeScript/ESLint/Prettier config.
- `docker-compose.yml` with a Postgres 17 pgvector service and persistent volume.
- `packages/db`: Drizzle client, empty schema, migration runner, and database health helper.
- `apps/api`: Fastify app with Zod validation, CORS, OpenAPI/Swagger UI at `/docs`, `/health`, `/health/db`, structured errors, and an optional bearer-token guard.
- `apps/web`: React dashboard shell with navigation, placeholder pages, and an API status indicator.
- Project docs: README, architecture, roadmap, data model, ADR, and this log.

### Verified (2026-11-09)

- `pnpm install` succeeds at the workspace root (474 packages installed).
- `@toi/db` builds cleanly with `tsc`.
- `@toi/api` and `@toi/web` both pass `tsc --noEmit` typecheck.
- `@toi/web` production build succeeds (`vite build`, ~242 kB JS bundle).
- API boots without a database:
  - `GET /health` returns 200.
  - `GET /health/db` returns 503 gracefully when Postgres is unavailable (error logged server-side, no stack trace leaked to the client).
  - `GET /docs` serves the OpenAPI UI (200).

### Verified with Postgres running (2026-11-09)

- `docker compose up -d db` starts the pgvector Postgres container, which reports `healthy`.
- `pnpm --filter @toi/db db:migrate` is a clean no-op on the empty Phase 0 schema (exits 0, logs "No migrations found") — the migrate runner now tolerates a missing migrations journal instead of throwing.
- `GET /health/db` returns 200 `{ ok: true }` against the live database (~100 ms ping).
- The React dashboard (served by `vite dev`) renders, its API-status badge reads "API & DB operational" (cross-origin calls to `/health` and `/health/db` succeed), and client-side routing between sections works.

### Next milestone

Phase 1: core opportunity management, manual submission, and AI extraction.
