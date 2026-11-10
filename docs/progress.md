# Progress Log

Living log of implementation status. Newest entries first.

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