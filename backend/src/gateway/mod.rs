mod events;
mod hub;
pub mod presence;
mod pubsub;
mod socket;

use axum::routing::get;
use axum::Router;

use crate::state::AppState;

pub use events::{Event, Target};
pub use hub::Hub;
pub use pubsub::{publish, start_bridge};

pub fn router() -> Router<AppState> {
    Router::new().route("/gateway", get(socket::upgrade))
}
