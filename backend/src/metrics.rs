//! Prometheus exporter. Each replica serves its own `/metrics`; nginx does not proxy it,
//! so it is reachable on the Docker network (`backend:3000/metrics`) but not from the host.
use std::time::Instant;

use axum::extract::{MatchedPath, Request, State};
use axum::http::header::CONTENT_TYPE;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use metrics_exporter_prometheus::{Matcher, PrometheusBuilder, PrometheusHandle};
use metrics_process::Collector;

use crate::state::AppState;

const HTTP_DURATION: &str = "glacier_http_request_duration_seconds";
const HTTP_BUCKETS: &[f64] = &[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0];

/// Installs the global recorder. Call once per process.
pub fn install() -> Result<PrometheusHandle, Box<dyn std::error::Error + Send + Sync>> {
    let handle = PrometheusBuilder::new()
        .set_buckets_for_metric(Matcher::Full(HTTP_DURATION.into()), HTTP_BUCKETS)?
        .install_recorder()?;
    Collector::default().describe();
    describe();
    Ok(handle)
}

fn describe() {
    metrics::describe_counter!(
        "glacier_http_requests_total",
        "HTTP requests by method, route and status"
    );
    metrics::describe_histogram!(HTTP_DURATION, metrics::Unit::Seconds, "HTTP request latency");
    metrics::describe_gauge!(
        "glacier_gateway_connections",
        "WebSocket gateway connections on this replica"
    );
    metrics::describe_counter!(
        "glacier_gateway_connections_total",
        "WebSocket gateway connections opened"
    );
    metrics::describe_counter!(
        "glacier_events_published_total",
        "Events published to the Redis bus by this replica"
    );
    metrics::describe_counter!("glacier_events_received_total", "Events received from the Redis bus");
    metrics::describe_counter!("glacier_frames_sent_total", "Gateway frames queued to local sockets");
    metrics::describe_counter!(
        "glacier_rate_limited_total",
        "Requests rejected by the rate limiter, by scope"
    );
    metrics::describe_gauge!(
        "glacier_db_pool_connections",
        "Open database connections, by pool and state"
    );
}

pub fn router() -> Router<AppState> {
    Router::new().route("/metrics", get(render))
}

/// Samples point-in-time gauges, then renders everything in the text exposition format.
async fn render(State(state): State<AppState>) -> impl IntoResponse {
    Collector::default().collect();
    metrics::gauge!("glacier_gateway_connections").set(state.hub.len() as f64);
    for (pool, db) in [("primary", &state.db.writer), ("replica", &state.db.reader)] {
        let idle = db.num_idle() as f64;
        let open = f64::from(db.size());
        metrics::gauge!("glacier_db_pool_connections", "pool" => pool, "state" => "idle").set(idle);
        metrics::gauge!("glacier_db_pool_connections", "pool" => pool, "state" => "in_use").set(open - idle);
    }
    ([(CONTENT_TYPE, "text/plain; version=0.0.4")], state.metrics.render())
}

/// Counts requests and records latency, labelled by the route template (not the raw path)
/// so ids in URLs don't create a series per resource.
pub async fn track(req: Request, next: Next) -> Response {
    let start = Instant::now();
    let method = req.method().to_string();
    let route = req
        .extensions()
        .get::<MatchedPath>()
        .map_or_else(|| "unmatched".to_string(), |p| p.as_str().to_string());
    let response = next.run(req).await;
    let status = response.status().as_u16().to_string();
    let labels = [("method", method), ("route", route), ("status", status)];
    metrics::counter!("glacier_http_requests_total", &labels).increment(1);
    metrics::histogram!(HTTP_DURATION, &labels).record(start.elapsed().as_secs_f64());
    response
}
