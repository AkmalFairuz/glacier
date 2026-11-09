//! Small Redis JSON cache helpers. Keys are namespaced with `glacier:`.
use redis::AsyncCommands;
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::error::AppResult;
use crate::id::Id;
use crate::state::AppState;

pub const DEFAULT_TTL: u64 = 600;

pub fn user_key(id: Id) -> String {
    format!("glacier:user:{id}")
}
pub fn session_key(hash: &str) -> String {
    format!("glacier:session:{hash}")
}
pub fn server_key(id: Id) -> String {
    format!("glacier:server:{id}")
}
pub fn perm_ctx_key(server: Id, version: u64) -> String {
    format!("glacier:permctx:{server}:{version}")
}
pub fn perm_version_key(server: Id) -> String {
    format!("glacier:permver:{server}")
}
pub fn member_roles_key(server: Id, user: Id) -> String {
    format!("glacier:mroles:{server}:{user}")
}

pub async fn get_json<T: DeserializeOwned>(state: &AppState, key: &str) -> AppResult<Option<T>> {
    let raw: Option<String> = state.redis().get(key).await?;
    match raw {
        Some(s) => Ok(serde_json::from_str(&s).ok()),
        None => Ok(None),
    }
}

pub async fn set_json<T: Serialize>(state: &AppState, key: &str, value: &T, ttl: u64) -> AppResult<()> {
    let raw = serde_json::to_string(value)?;
    let _: () = state.redis().set_ex(key, raw, ttl).await?;
    Ok(())
}

pub async fn del(state: &AppState, key: &str) -> AppResult<()> {
    let _: () = state.redis().del(key).await?;
    Ok(())
}

/// Read-through cache: return cached value or compute, store and return it.
pub async fn remember<T, F, Fut>(state: &AppState, key: &str, ttl: u64, load: F) -> AppResult<T>
where
    T: Serialize + DeserializeOwned,
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = AppResult<T>>,
{
    if let Some(hit) = get_json(state, key).await? {
        return Ok(hit);
    }
    let value = load().await?;
    set_json(state, key, &value, ttl).await?;
    Ok(value)
}
