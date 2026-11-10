# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Builder: install the pnpm workspace and compile @toi/db + @toi/api.
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

# Copy the whole workspace first, then install. This is the reliable pnpm-
# workspace pattern: installing after the source is present creates each
# package's node_modules/.bin links correctly (a later `COPY . .` can otherwise
# disturb the per-package symlinks pnpm sets up).
COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @toi/db build && pnpm --filter @toi/api build

# ---------------------------------------------------------------------------
# Runtime: a resolvable workspace install (not a pruned/minimal image).
#
# `packages/db/drizzle` MUST sit next to `packages/db/dist`: the migrator
# resolves migrations via `new URL('../drizzle', import.meta.url)` relative to
# the compiled dist/migrator.js.
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

WORKDIR /app

# Copy the entire built workspace. pnpm links workspace packages into each
# consumer's own node_modules (e.g. apps/api/node_modules/@toi/db -> packages/db)
# and per-package node_modules hold their deps, so the whole tree is copied to
# keep every symlink resolvable. packages/db/drizzle (migrations) comes along,
# sitting beside packages/db/dist as the migrator expects.
COPY --from=builder /app ./

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=8080

EXPOSE 8080

CMD ["node", "apps/api/dist/index.js"]
