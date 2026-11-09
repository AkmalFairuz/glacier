pub mod handlers;
pub mod models;
pub mod reactions;
pub mod repo;
pub mod search;

use axum::routing::{get, patch, post, put};
use axum::Router;

use crate::state::AppState;

pub use models::Attachment;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/channels/{id}/messages", get(handlers::list).post(handlers::create))
        .route(
            "/channels/{cid}/messages/{mid}",
            patch(handlers::edit).delete(handlers::delete),
        )
        .route(
            "/channels/{cid}/messages/{mid}/embeds",
            axum::routing::delete(crate::embeds::remove),
        )
        .route(
            "/channels/{cid}/messages/{mid}/reactions/{emoji}",
            put(reactions::add).delete(reactions::remove),
        )
        .route("/channels/{id}/typing", post(handlers::typing))
        .route("/servers/{id}/messages/search", get(search::in_server))
        .route("/channels/{id}/messages/search", get(search::in_channel))
}
