# syntax=docker/dockerfile:1.7
# Build context: repository root (see .github/workflows/worker-ci.yml).
# CI builds each architecture on its matching native runner.

ARG RUST_VERSION=1.96

FROM rust:${RUST_VERSION}-slim-bookworm AS chef
RUN cargo install cargo-chef --locked --version ^0.1
WORKDIR /app

FROM chef AS planner
COPY apps/worker/ .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
# The worker orchestrates database/network work. Avoid expensive cross-crate
# link optimization in the image build; use the same profile for dependencies
# and the final binary so cargo-chef's cache remains reusable.
ENV CARGO_PROFILE_RELEASE_LTO=false \
    CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
COPY --from=planner /app/recipe.json recipe.json
# Dependencies only: cached until Cargo.toml/Cargo.lock change.
RUN cargo chef cook --release --locked --recipe-path recipe.json --bin worker
COPY apps/worker/ .
ARG WORKER_GIT_SHA=""
ENV WORKER_GIT_SHA=${WORKER_GIT_SHA}
RUN cargo build --release --locked --bin worker \
 && install -D -m 0755 target/release/worker /out/worker

# The catalog job runs the existing compiled API maintenance command instead of
# duplicating its provider and scoring logic in Rust.
FROM node:24-bookworm-slim AS node-dependencies
WORKDIR /app
RUN npm install --global pnpm@11.2.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/db/package.json ./packages/db/package.json

FROM node-dependencies AS node-build
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api ./apps/api
COPY packages/db ./packages/db
RUN pnpm --filter @vefacaglar/db exec tsc && pnpm --filter api exec tsc

FROM node-dependencies AS production-dependencies
RUN pnpm install --frozen-lockfile --prod --filter api...

# Both runtime binaries use bookworm's glibc. Keeping Node's supported runtime
# avoids copying a binary into distroless without its shared libraries.
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app ./
COPY --from=node-build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=node-build --chown=node:node /app/packages/db/dist ./packages/db/dist
COPY --from=builder /out/worker /usr/local/bin/worker
# Executed natively for each buildx platform, including the runtime's Node ABI.
RUN node --check apps/api/dist/scripts/refresh-popularity.js \
 && node --check apps/api/dist/scripts/sync-movies.js \
 && node --check apps/api/dist/scripts/refresh-movie-popularity.js \
 && node -e "require('./apps/api/dist/container.js')"
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=2048 \
    RUST_LOG=info \
    RUST_LIB_BACKTRACE=1 \
    WORKER_LOG_FORMAT=json \
    LOG_ENVIRONMENT=production \
    WORKER_HEALTH_FILE=/tmp/worker-health
USER node:node
# Exits 0 when the worker's DB heartbeat (written every 10 s) is < 30 s old.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/usr/local/bin/worker", "--healthcheck"]
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/worker"]
