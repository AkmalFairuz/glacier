pub mod handlers;
pub mod models;
pub mod repo;

use axum::routing::{get, put};
use axum::Router;

use crate::state::AppState;

pub use models::User;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/users/@me", get(handlers::me).patch(handlers::update_me))
        .route("/users/search", get(handlers::search))
        .route("/users/{id}/profile", get(handlers::profile))
        .route("/users/{id}/note", put(handlers::set_note))
        .route("/config/ice", get(handlers::ice_config))
}
