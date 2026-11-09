mod extractor;
pub mod handlers;
pub mod models;
mod password;
mod repo;
pub mod session;

use axum::routing::post;
use axum::Router;

use crate::state::AppState;

pub use extractor::AuthUser;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(handlers::register))
        .route("/auth/login", post(handlers::login))
        .route("/auth/logout", post(handlers::logout))
        .route("/auth/password", post(handlers::change_password))
        .route("/auth/sessions/revoke-others", post(handlers::revoke_other_sessions))
}
