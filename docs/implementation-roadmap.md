# Implementation Roadmap

## Phase 0 — Foundation (current)

Establish the monorepo and a runnable skeleton.

- pnpm workspace with `apps/api`, `apps/web`, `packages/db`
- Root TypeScript, ESLint, and Prettier configuration
- Docker Compose Postgres using the pgvector image
- `packages/db` Drizzle skeleton with empty schema and migration runner
- `apps/api` Fastify server with `/health`, `/health/db`, and `/docs` OpenAPI UI
- `apps/web` React dashboard shell with navigation and placeholder pages
- Project documentation

## Phase 1 — Core opportunity management

- Database schema and migrations for opportunities and evidence
- Manual opportunity submission
- AI extraction behind a provider-independent layer, with validated outputs
- Basic opportunity list and detail views in the dashboard

## Phase 2 — Ingestion engine

- First permitted public source integration
- Source and source-record persistence with provenance
- Repeatable ingestion runs
- Worker and job queue introduced when ingestion requires asynchronous processing

## Phase 3 — Lead management / CRM

- Lead qualification and status tracking
- Outreach activities and follow-up history
- Lead list and detail workflows in the dashboard

## Phase 4 — Problem intelligence

- Embeddings for problems and opportunities
- Recurring-problem clustering
- Cluster review and service-idea exploration

## Phase 5 — Optimisation

- Scoring refinement and prioritisation tuning
- Performance, reliability, and operational improvements
- Workflow polish based on real usage