use axum::middleware;
use axum::routing::get;
use axum::Router;
use tower_http::trace::TraceLayer;
use utoipa_swagger_ui::SwaggerUi;

use crate::state::AppState;
use crate::{
    auth, channels, dms, gateway, invites, members, messages, metrics, openapi, reads, roles, servers, uploads, users,
    voice,
};

/// All REST routes, relative to `/api`.
pub fn api() -> Router<AppState> {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .merge(auth::router())
        .merge(users::router())
        .merge(servers::router())
        .merge(members::router())
        .merge(roles::router())
        .merge(channels::router())
        .merge(messages::router())
        .merge(uploads::router())
        .merge(invites::router())
        .merge(dms::router())
        .merge(voice::router())
        .merge(reads::router())
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .nest("/api", api())
        .merge(gateway::router())
        .merge(metrics::router())
        .merge(SwaggerUi::new("/api/docs").url("/api/openapi.json", openapi::spec()))
        .layer(middleware::from_fn(metrics::track))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[cfg(test)]
mod tests {
    #[test]
    fn routes_do_not_conflict() {
        let _ = super::api();
        let _ = crate::gateway::router();
    }
}
