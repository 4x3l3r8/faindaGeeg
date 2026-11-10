# ADR 0002: Provider-Agnostic Embeddings

- **Status:** Accepted
- **Date:** 2026-11-10

## Context

Problem intelligence needs text embeddings to cluster recurring problems. There is no OpenAI budget initially, and OpenRouter — the chosen LLM provider — exposes no embeddings endpoint. Embedding quality therefore has to come from a backend that can be swapped without reworking the schema, the clustering code, or the API, and the system must keep working with no API key at all.

Different embedding models produce vectors of different dimensions and in different vector spaces, so vectors from one model cannot be compared with vectors from another.

## Decision

- **Embeddings are provider-agnostic**, selected by `EMBEDDINGS_PROVIDER`:
  - `local` (default) — a built-in deterministic hashing embedder, no key, fully offline.
  - `openai` — requires `OPENAI_API_KEY`; optional `OPENAI_EMBEDDINGS_MODEL` (default `text-embedding-3-small`) and optional `EMBEDDING_DIM` output truncation.
  - `huggingface` (or `hf`) — requires `HF_API_KEY`; `HF_EMBEDDINGS_MODEL` (default `BAAI/bge-small-en-v1.5`), free tier.
  - A missing cloud key falls back to the local embedder.
- **Storage is dimensionless.** The `opportunities.embedding` and `problem_clusters.centroid` columns use a dimensionless pgvector column declared via a Drizzle `customType` (`agnosticVector`), so any model's output size fits without a schema migration.
- **Switching provider or model requires a re-embed.** Because vector spaces and dimensions differ, the provider/model can only change by rebuilding: `POST /api/problem-clusters/rebuild {"reembed": true}` clears existing embeddings and clusters and rebuilds them with the current embedder. A mismatch without `reembed` raises an explicit error.
- **The local embedder is approximate** (feature hashing, not learned semantics), intended for offline and development use; HuggingFace and OpenAI provide real semantic quality.

## Consequences

- The system runs with zero configuration and no API cost, then upgrades to semantic embeddings by setting an env var.
- The database and clustering code never assume a fixed dimension, so models can be adopted or replaced freely.
- Any provider/model change is a deliberate, one-time re-embed operation, not a transparent swap.
- Clustering quality with the default local embedder is limited; meaningful semantic clustering requires a cloud provider.
