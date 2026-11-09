//! Opaque session tokens. The client holds the raw token; MySQL stores its
//! SHA-256 hash and Redis caches hash -> user id.
use chrono::{Duration, Utc};
use rand::RngCore;
use redis::AsyncCommands;
use sha2::{Digest, Sha256};

use crate::cache;
use crate::error::AppResult;
use crate::id::Id;
use crate::state::AppState;

const SESSION_DAYS: i64 = 30;
const CACHE_TTL: u64 = 3600;

pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

pub async fn create(state: &AppState, user_id: Id) -> AppResult<String> {
    let mut raw = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut raw);
    let token = hex::encode(raw);
    let now = Utc::now();
    sqlx::query("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
        .bind(hash_token(&token))
        .bind(user_id)
        .bind(now)
        .bind(now + Duration::days(SESSION_DAYS))
        .execute(&state.db.writer)
        .await?;
    Ok(token)
}

pub async fn resolve(state: &AppState, token: &str) -> AppResult<Option<Id>> {
    let hash = hash_token(token);
    let key = cache::session_key(&hash);
    let mut redis = state.redis();
    let cached: Option<u64> = redis.get(&key).await?;
    if let Some(id) = cached {
        return Ok(Some(Id(id)));
    }
    let row: Option<(Id,)> = sqlx::query_as("SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?")
        .bind(&hash)
        .bind(Utc::now())
        .fetch_optional(&state.db.writer)
        .await?;
    if let Some((id,)) = row {
        let _: () = redis.set_ex(&key, id.0, CACHE_TTL).await?;
        return Ok(Some(id));
    }
    Ok(None)
}

pub async fn revoke(state: &AppState, token_hash: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM sessions WHERE token_hash = ?")
        .bind(token_hash)
        .execute(&state.db.writer)
        .await?;
    cache::del(state, &cache::session_key(token_hash)).await
}

/// Revokes every session of `user` except `keep`; returns how many were removed.
pub async fn revoke_others(state: &AppState, user: Id, keep: &str) -> AppResult<u64> {
    let hashes: Vec<(String,)> =
        sqlx::query_as("SELECT token_hash FROM sessions WHERE user_id = ? AND token_hash <> ?")
            .bind(user)
            .bind(keep)
            .fetch_all(&state.db.writer)
            .await?;
    for (hash,) in &hashes {
        revoke(state, hash).await?;
    }
    Ok(hashes.len() as u64)
}
