# Progress Log

Living log of implementation status. Newest entries first.

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