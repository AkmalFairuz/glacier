pub mod handlers;
pub mod models;
pub mod repo;

use axum::routing::get;
use axum::Router;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/servers/{id}/invites", get(handlers::list).post(handlers::create))
        .route(
            "/invites/{code}",
            get(handlers::preview).post(handlers::accept).delete(handlers::delete),
        )
}
