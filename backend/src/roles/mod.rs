pub mod handlers;
pub mod models;
pub mod repo;

use axum::routing::{get, patch};
use axum::Router;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/servers/{id}/roles", get(handlers::list).post(handlers::create))
        .route(
            "/servers/{id}/roles/{rid}",
            patch(handlers::update).delete(handlers::delete),
        )
}
