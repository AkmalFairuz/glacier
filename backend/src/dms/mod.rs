pub mod handlers;
pub mod models;
pub mod repo;

use axum::routing::{delete, get, patch, put};
use axum::Router;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/dms", get(handlers::list).post(handlers::create))
        .route("/dms/{id}", patch(handlers::rename))
        .route("/dms/{id}/recipients/{uid}", put(handlers::add_recipient))
        .route("/dms/{id}/recipients/@me", delete(handlers::leave))
}
