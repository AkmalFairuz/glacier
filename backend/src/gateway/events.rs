use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::id::Id;

/// Server -> client frame: `{ "t": EVENT, "d": payload }`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Event {
    pub t: String,
    pub d: Value,
}

impl Event {
    pub fn new(t: &str, d: impl Serialize) -> Self {
        Self {
            t: t.to_string(),
            d: serde_json::to_value(d).unwrap_or(Value::Null),
        }
    }
}

/// Who should receive an event. `Channel` is resolved to concrete
/// recipients before it is published.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", content = "id", rename_all = "snake_case")]
pub enum Target {
    Server(Id),
    Servers(Vec<Id>),
    User(Id),
    Users(Vec<Id>),
    Channel { server: Option<Id>, channel: Id },
}

/// What travels over Redis pub/sub between replicas.
#[derive(Debug, Serialize, Deserialize)]
pub struct Envelope {
    pub target: Target,
    pub event: Event,
}

/// Client -> server frame: `{ "op": OP, "d": payload }`.
#[derive(Debug, Deserialize)]
pub struct ClientFrame {
    pub op: String,
    #[serde(default)]
    pub d: Value,
}
