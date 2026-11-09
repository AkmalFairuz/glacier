# Glacier backend

The Glacier API and WebSocket gateway, written in Rust. Every replica is stateless:
shared state lives in MariaDB and Redis, so you can run as many as you need behind nginx.

- **HTTP**: axum 0.8, routes under `/api`, Swagger UI at `/api/docs`
- **Database**: MariaDB through sqlx with raw SQL (no ORM); writes go to the primary, listing reads to the replica
- **Redis**: sessions, cache, rate limits, presence, voice state, and pub/sub between replicas
- **Uploads**: MinIO (S3 API), served by nginx under `/files`

## Run

Start the data services first (see the root README for publishing their ports), then:

```sh
cargo run                  # http://localhost:3000
cargo run -- openapi       # write the split YAML spec to ../openapi/ and exit
```

The single migration in `migrations/` runs at startup. Replicas take a database lock, so
only one of them applies it.

## Configuration

All settings come from environment variables. In Docker, `docker-compose.yml` sets them from `.env`; the defaults below are
for running on the host.

| Variable              | Default                                          |
| --------------------- | ------------------------------------------------ |
| `BIND_ADDR`           | `0.0.0.0:3000`                                   |
| `DATABASE_URL`        | `mysql://glacier:glacier@127.0.0.1:3306/glacier` |
| `DATABASE_READ_URL`   | unset (reads go to the primary)                  |
| `REDIS_URL`           | `redis://127.0.0.1:6379`                         |
| `S3_ENDPOINT`         | `http://127.0.0.1:9000`                          |
| `S3_BUCKET`           | `glacier-uploads`                                |
| `S3_ACCESS_KEY`       | `glacier`                                        |
| `S3_SECRET_KEY`       | `glacier-secret`                                 |
| `PUBLIC_FILES_PREFIX` | `/files`                                         |
| `STUN_URLS`           | `stun:stun.l.google.com:19302` (comma-separated) |
| `RUST_LOG`            | `glacier=info,tower_http=info`                   |

## Metrics

Each replica serves Prometheus metrics at `GET /metrics` on port 3000 (internal only; nginx doesn't
proxy it). They cover HTTP requests and latency per route template, gateway connections and
events, rate limiting, database pool usage and process stats, all prefixed `glacier_` or
`process_`. Compose scrapes them already (see Monitoring in the root README).

## Checks

```sh
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

## Layout

```
src/main.rs        Entry point (kept under 50 lines)
src/routes.rs      Assembles the /api router and the /gateway socket
src/<feature>/     auth, users, servers, members, roles, channels, messages, uploads,
                   invites, dms, reads, voice: handlers.rs, repo.rs (raw SQL), models.rs
src/permissions/   Permission bits and the resolver (owner, @everyone, roles, overwrites)
src/gateway/       WebSocket sessions, READY, presence, Redis pub/sub bridge
src/openapi/       OpenAPI document and the split YAML export
src/metrics.rs     Prometheus exporter (/metrics) and the HTTP metrics middleware
migrations/        Database schema
```
