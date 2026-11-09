# Architecture

## Style: modular monolith

The system is a single deployable API with clear internal module boundaries, plus a separate web frontend and a shared database package. Modules are organised by business capability; business logic must not depend on Fastify request/reply types so it can be reused by future jobs and tests.

## Workspace layout

```
apps/
  api/        Fastify HTTP API and module boundaries
  web/        React + Vite dashboard shell
packages/
  db/         Drizzle ORM client, schema, migrations, health check
```

### Responsibilities

- **`apps/api`** — HTTP transport, validation (Zod), OpenAPI generation, auth guard, and route composition. Modules own their business logic and persistence orchestration. Phase 0 exposes only health routes.
- **`apps/web`** — React dashboard shell: layout, navigation, placeholder pages, API health status. No live domain data yet.
- **`packages/db`** — single source of truth for database access: connection pooling, Drizzle client, schema export (currently empty), migration runner, and a `pingDatabase` health helper.
- **Root** — pnpm workspace configuration, shared TypeScript/ESLint/Prettier config, Docker Compose for Postgres, and `env.example`.

## High-level processing flow (target design)

1. **Ingest** permitted public sources into source records, preserving raw content and provenance.
2. **Extract** opportunities and problem signals from source records using the AI layer, with schema-validated outputs.
3. **Persist** opportunities with linked evidence so every claim remains traceable to its source.
4. **Score** opportunities deterministically in application code, not by the LLM.
5. **Qualify and track** leads through outreach activities.
6. **Cluster** recurring problems using embeddings in a later phase.

Only steps required for Phase 0 infrastructure exist today; the flow above describes the intended modular boundaries.

## Phase 0 deviations from the original proposal

- **No separate worker app.** Background processing is folded into the API for now; a dedicated worker arrives in Phase 2 when ingestion needs it.
- **No Redis/BullMQ yet.** Job queues are deferred until ingestion requires asynchronous processing.
- **Consolidated packages.** The starter ships only `apps/api`, `apps/web`, and `packages/db`; additional packages are added when a concrete need appears.
- **TypeScript/Fastify instead of C#/.NET.** Chosen for a single-language stack, shared types, and faster iteration.
- **pgvector Postgres from day one, vectors deferred.** The image is used now to avoid a database migration later; embeddings and clustering are Phase 4 work.
- **OpenRouter first, AI layer not built.** Provider selection is recorded, but no provider client or prompt pipeline exists in Phase 0.

## Architectural principles

- **Business logic independent of HTTP.** Domain logic must not depend on Fastify or request objects.
- **Evidence preserved per opportunity.** Every opportunity keeps links to the source evidence that justified it.
- **AI outputs always validated.** All model output is parsed and schema-validated before use.
- **External content is untrusted.** Ingested source material is treated as untrusted input, never executed or trusted verbatim.
- **Scoring is deterministic in app code.** The LLM may extract facts, but scoring and ranking use deterministic application logic.
- **Prompts and scoring are versioned.** Changes to prompts or scoring are recorded so results remain reproducible and comparable.