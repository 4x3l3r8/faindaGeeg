# ADR 0001: Phase 0 Stack Adjustments

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

The original proposal described a broader platform with a separate worker, a Redis-backed job queue, and several packages. Phase 0 needs a runnable foundation that can be validated quickly, without building infrastructure that has no consumer yet. The system is a personal, single-operator tool.

## Decision

Adopt the following Phase 0 trims:

- **TypeScript/Fastify over C#/.NET.** A single-language stack with shared types and fast iteration.
- **Drop the separate worker app until Phase 2.** Background processing is unnecessary until ingestion exists.
- **Defer Redis + BullMQ until ingestion.** No queue is introduced before there are asynchronous jobs.
- **Start with `apps/api` + `apps/web` + `packages/db`.** Add packages only when a concrete boundary requires one.
- **Use the pgvector Postgres image from day one.** Vectors and clustering are deferred to Phase 4, but using the image now avoids a database migration later.
- **Use OpenRouter as the first LLM provider, with embeddings deferred.** The AI layer is provider-independent by design and is not implemented in Phase 0.
- **No auth in the MVP beyond an optional bearer token.** Set `API_AUTH_TOKEN` to require a bearer token; leave it blank for open single-user access. Health and docs routes remain public.

## Consequences

- The foundation stays small and fast to verify.
- Phase 2 must introduce the worker and queue along with the first ingestion source.
- Phase 4 gains vector support without changing the database image.
- The API remains the only backend process until Phase 2, so long-running work must be added deliberately.
- Auth is minimal; the system must not be exposed to untrusted networks without adding real authentication.