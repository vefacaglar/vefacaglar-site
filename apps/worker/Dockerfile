# syntax=docker/dockerfile:1.7
# Build context: apps/worker (see .github/workflows/worker-ci.yml).
# Multi-arch: buildx runs each stage natively per platform (QEMU in CI).

ARG RUST_VERSION=1.96

FROM rust:${RUST_VERSION}-slim-bookworm AS chef
RUN cargo install cargo-chef --locked --version ^0.1
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Dependencies only: cached until Cargo.toml/Cargo.lock change.
RUN cargo chef cook --release --locked --recipe-path recipe.json --bin worker
COPY . .
ARG WORKER_GIT_SHA=""
ENV WORKER_GIT_SHA=${WORKER_GIT_SHA}
RUN cargo build --release --locked --bin worker \
 && install -D -m 0755 target/release/worker /out/worker

# distroless/cc: glibc + libgcc + CA certificates, no shell, runs as nonroot.
FROM gcr.io/distroless/cc-debian12:nonroot AS runtime
COPY --from=builder /out/worker /usr/local/bin/worker
ENV RUST_LOG=info \
    WORKER_LOG_FORMAT=json \
    WORKER_HEALTH_FILE=/tmp/worker-health
USER nonroot:nonroot
# Exits 0 when the worker's DB heartbeat (written every 10 s) is < 30 s old.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/usr/local/bin/worker", "--healthcheck"]
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/worker"]
