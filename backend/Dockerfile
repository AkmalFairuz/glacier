# Versions are pinned so builds are reproducible.
# FROM rust:1-slim-bookworm AS chef
FROM rust:1.99.0-slim-bookworm AS chef
# RUN cargo install cargo-chef --locked
RUN cargo install cargo-chef --locked --version 0.1.78
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Dependencies are built from the recipe first, so code changes reuse this layer.
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --bin glacier

# FROM debian:bookworm-slim AS runtime
FROM debian:bookworm-20261020-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 glacier
WORKDIR /app
COPY --from=builder /app/target/release/glacier /usr/local/bin/glacier
# Defaults; docker-compose.yml sets the rest (database, Redis, S3).
ENV BIND_ADDR=0.0.0.0:3000 \
    RUST_LOG=glacier=info,tower_http=info
USER glacier
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["glacier"]
