pub mod handlers;
mod storage;

use axum::extract::DefaultBodyLimit;
use axum::routing::post;
use axum::Router;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/channels/{id}/attachments", post(handlers::attachment))
        .route("/uploads/image", post(handlers::image))
        .layer(DefaultBodyLimit::max(handlers::MAX_ATTACHMENT + 64 * 1024))
}
