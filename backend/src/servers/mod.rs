pub mod handlers;
pub mod models;
pub mod repo;
pub mod templates;

use axum::routing::{get, post};
use axum::Router;

use crate::state::AppState;

pub use models::Server;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/servers", get(handlers::list).post(handlers::create))
        .route("/servers/discover", get(handlers::discover))
        .route(
            "/servers/{id}",
            get(handlers::get).patch(handlers::update).delete(handlers::delete),
        )
        .route("/servers/{id}/join", post(handlers::join))
        .route("/servers/{id}/permissions", get(handlers::my_permissions))
}
