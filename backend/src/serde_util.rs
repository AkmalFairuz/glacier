use serde::{Deserialize, Deserializer};

/// Distinguishes a missing field (`None`) from an explicit `null`
/// (`Some(None)`) in PATCH bodies. Use with `#[serde(default)]`.
pub fn double_option<'de, T, D>(d: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(d).map(Some)
}
