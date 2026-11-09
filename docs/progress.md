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

### Not yet verified (Docker daemon was not running this session)

- Starting the Postgres container via `docker compose up -d db`.
- Running migrations (Phase 0 has no tables, so little to exercise).
- `/health/db` returning green against a live database.
- Web dashboard talking to the API in a browser.

### Next milestone

Phase 1: core opportunity management, manual submission, and AI extraction.