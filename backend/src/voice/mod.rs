pub mod handlers;
pub mod state;

use axum::routing::get;
use axum::Router;

use crate::state::AppState;

pub use handlers::{for_server, join, leave, signal, update};
pub use state::VoiceState;

pub fn router() -> Router<AppState> {
    Router::new().route("/servers/{id}/voice-states", get(handlers::server_states))
}
