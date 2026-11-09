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

All settings come from environment variables. The defaults match `docker-compose.yaml`.

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

Each replica serves Prometheus metrics at `GET /metrics` (port 3000). nginx doesn't proxy this
path, so it's reachable only inside the Docker network (`http://backend:3000/metrics`), not from
the host. To scrape every replica, let Prometheus resolve the service name:

```yaml
scrape_configs:
  - job_name: glacier
    dns_sd_configs:
      - names: [backend]
        type: A
        port: 3000
```

| Metric                                  | Type      | Labels                           |
| --------------------------------------- | --------- | -------------------------------- |
| `glacier_http_requests_total`           | counter   | `method`, `route`, `status`      |
| `glacier_http_request_duration_seconds` | histogram | `method`, `route`, `status`      |
| `glacier_gateway_connections`           | gauge     |                                  |
| `glacier_gateway_connections_total`     | counter   |                                  |
| `glacier_events_published_total`        | counter   |                                  |
| `glacier_events_received_total`         | counter   |                                  |
| `glacier_frames_sent_total`             | counter   |                                  |
| `glacier_rate_limited_total`            | counter   | `scope`                          |
| `glacier_db_pool_connections`           | gauge     | `pool`, `state`                  |
| `process_*`                             | various   | CPU, memory, open files, threads |

`route` is the route template (`/api/channels/{id}/messages`), not the raw path, so ids don't
create a new series per resource.

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
