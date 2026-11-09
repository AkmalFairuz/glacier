use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use std::str::FromStr;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Snowflake ID. Stored as BIGINT UNSIGNED, serialized to JSON as a string
/// so JavaScript clients do not lose precision.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, sqlx::Type)]
#[sqlx(transparent)]
pub struct Id(pub u64);

impl fmt::Display for Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl FromStr for Id {
    type Err = std::num::ParseIntError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        s.parse().map(Id)
    }
}

impl Serialize for Id {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.collect_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for Id {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct IdVisitor;
        impl Visitor<'_> for IdVisitor {
            type Value = Id;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("a snowflake id as string or integer")
            }
            fn visit_str<E: de::Error>(self, v: &str) -> Result<Id, E> {
                v.parse().map_err(E::custom)
            }
            fn visit_u64<E: de::Error>(self, v: u64) -> Result<Id, E> {
                Ok(Id(v))
            }
        }
        d.deserialize_any(IdVisitor)
    }
}

impl utoipa::PartialSchema for Id {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::schema::Schema> {
        use utoipa::openapi::schema::{ObjectBuilder, Schema, Type};
        let object = ObjectBuilder::new()
            .schema_type(Type::String)
            .description(Some("Snowflake ID (u64 encoded as a string)"))
            .examples(["160427101208920064"])
            .build();
        utoipa::openapi::RefOr::T(Schema::Object(object))
    }
}

impl utoipa::ToSchema for Id {}

/// 2026-01-01T00:00:00Z in milliseconds.
const EPOCH_MS: u64 = 1_767_225_600_000;
const WORKER_BITS: u64 = 10;
const SEQ_BITS: u64 = 12;
const MAX_SEQ: u64 = (1 << SEQ_BITS) - 1;

/// Snowflake generator: 41 bits time | 10 bits worker | 12 bits sequence.
/// Every backend replica gets a distinct worker id at startup (see state.rs).
pub struct Snowflake {
    worker: u64,
    inner: Mutex<(u64, u64)>,
}

impl Snowflake {
    pub fn new(worker: u64) -> Self {
        Self {
            worker: worker & ((1 << WORKER_BITS) - 1),
            inner: Mutex::new((0, 0)),
        }
    }

    pub fn worker_id(&self) -> u64 {
        self.worker
    }

    pub fn next(&self) -> Id {
        let mut guard = self.inner.lock().expect("snowflake mutex poisoned");
        let (last, seq) = &mut *guard;
        let mut now = now_ms();
        if now < *last {
            now = *last;
        }
        if now == *last {
            *seq = (*seq + 1) & MAX_SEQ;
            if *seq == 0 {
                while now <= *last {
                    now = now_ms();
                }
            }
        } else {
            *seq = 0;
        }
        *last = now;
        Id(((now - EPOCH_MS) << (WORKER_BITS + SEQ_BITS)) | (self.worker << SEQ_BITS) | *seq)
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock before 1970")
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn ids_are_unique_and_increasing() {
        let gen = Snowflake::new(7);
        let ids: Vec<Id> = (0..10_000).map(|_| gen.next()).collect();
        assert!(ids.windows(2).all(|w| w[0] < w[1]));
        assert_eq!(ids.iter().collect::<HashSet<_>>().len(), ids.len());
    }

    #[test]
    fn worker_bits_are_embedded() {
        let id = Snowflake::new(513).next();
        assert_eq!((id.0 >> SEQ_BITS) & 0x3ff, 513);
    }

    #[test]
    fn id_serializes_as_string() {
        assert_eq!(serde_json::to_string(&Id(42)).unwrap(), "\"42\"");
        let parsed: Id = serde_json::from_str("\"42\"").unwrap();
        assert_eq!(parsed, Id(42));
    }
}
