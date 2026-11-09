pub mod handlers;
pub mod models;
pub mod repo;

use axum::routing::{get, put};
use axum::Router;

use crate::state::AppState;

pub use handlers::mark_read;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/channels/{id}/ack", put(handlers::ack))
        .route("/channels/{id}/receipts", get(handlers::receipts))
}
