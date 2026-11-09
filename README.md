<p align="center">
  <img src="frontend/public/favicon.svg" width="96" height="96" alt="Glacier logo">
</p>

<h1 align="center"><b>Glacier</b></h1>

<p align="center">
  A self-hosted chat app with servers, text channels, voice/video channels with
  screen sharing, direct messages (with calls), and roles and permissions.
</p>

<p align="center">
  <img src="docs/screenshot.webp" width="85%" alt="Glacier: a server's #general channel with the channel list and member list">
</p>

- **Backend**: Rust (axum, sqlx with raw SQL, no ORM), MariaDB primary + read replica, Redis, MinIO
- **Frontend**: Vite + React + TypeScript
- **Realtime**: WebSocket gateway; events fan out across backend replicas through Redis pub/sub
- **Voice / video**: WebRTC mesh (peer-to-peer); the backend relays signaling only. Public STUN only, with no TURN relay.

## Architecture

<p align="center">
  <img src="docs/architecture.svg" width="90%" alt="Glacier containers: the browser reaches nginx through the only published port, 8080:80; nginx, three backend replicas, Redis, MariaDB primary and replica, and MinIO share the glacier_default bridge network, and the data containers keep their state in four named volumes.">
</p>

## Run everything

```sh
docker compose up --build
```

Open http://localhost:8080 and register an account.

| Service                            | Purpose                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| `nginx`                            | Serves the built frontend; proxies `/api`, `/gateway`, `/files` |
| `backend` (×3)                     | Stateless API + gateway replicas                                |
| `mariadb-primary`                  | Writes, binlog source                                           |
| `mariadb-replica`                  | Read-only replica used for listing queries                      |
| `redis`                            | Sessions, cache, rate limits, presence, voice state, pub/sub    |
| `minio`                            | Uploaded files (bucket `glacier-uploads`, public read)          |
| `prometheus`, `grafana`, exporters | Monitoring (see [Monitoring](#monitoring))                      |

Scale the backend: `docker compose up -d --scale backend=5`. nginx re-resolves
the `backend` service name every 10 seconds, so it picks up new replicas.

## API

- Swagger UI: http://localhost:8080/api/docs
- Spec: http://localhost:8080/api/openapi.json (a copy is committed as split YAML in `openapi/`)
- Gateway: `ws://localhost:8080/gateway?token=<token>` (frames are `{op,d}` from the client and `{t,d}` from the server)

The spec is generated from the Rust handlers (utoipa) and written as YAML split across files:

```
openapi/
  openapi.yaml                    entry point: info, tags, security; $refs to everything else
  paths/<tag>/<path>.yaml         one path per file, grouped by tag (e.g. paths/channels/servers_id_channels.yaml)
  components/schemas/<Name>.yaml  one schema per file
```

The files are generated, so don't edit them by hand. After changing the API:

```sh
cd backend && cargo run -q -- openapi      # rewrites ../openapi/
cd ../frontend && npm run gen:api          # TypeScript types from openapi/openapi.yaml
```

## Monitoring

Grafana runs at http://localhost:3001 (`admin` / `glacier-grafana`) with Backend, Data services,
and Host and containers dashboards. Prometheus scrapes the backend replicas, exporters for
MariaDB, Redis and nginx, MinIO, node-exporter and cAdvisor. Only Grafana is published to the
host. Alert rules are in `monitoring/prometheus/rules/`.

## Local development

Start the data services with Docker and run the apps on the host:

```sh
docker compose up -d mariadb-primary mariadb-replica redis minio
```

Docker Compose doesn't publish the data service ports. For host development, add a
`docker-compose.override.yaml` that maps them (`3306`, `6379`, `9000`), then:

```sh
cd backend && cargo run            # http://localhost:3000, defaults match the compose credentials
cd frontend && npm install && npm run dev
```

Without `DATABASE_READ_URL`, the backend reads from the primary.

## Checks

```sh
cd backend && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
cd frontend && npm run format:check && npm run typecheck && npm run lint && npm run build
```

Format with `cargo fmt` and `npm run format`.

## Layout

```
backend/    Rust crate: one module per feature (handlers.rs, repo.rs with raw SQL, models.rs)
docs/       README screenshot and architecture diagram
frontend/   React app: src/ui (primitives), src/features/* (feature components and hooks)
monitoring/ Prometheus config and alert rules, Grafana provisioning and dashboards
nginx/      Reverse proxy config (baked into the frontend image)
openapi/    Generated OpenAPI spec (YAML, split per path and schema)
```

## Notes

- Without a TURN server, calls between users behind strict NATs may fail to connect.
- Bots and integrations are not implemented yet.

## License

[MIT](LICENSE)
