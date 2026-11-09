//! Online presence shared by all replicas: a Redis sorted set per user
//! holding one entry per live socket, scored by last heartbeat.
use redis::AsyncCommands;

use crate::error::AppResult;
use crate::id::Id;
use crate::state::AppState;

const STALE_SECS: i64 = 90;

fn key(user: Id) -> String {
    format!("glacier:presence:{user}")
}

fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

pub async fn is_online(state: &AppState, user: Id) -> AppResult<bool> {
    let mut redis = state.redis();
    let _: () = redis.zrembyscore(key(user), "-inf", now() - STALE_SECS).await?;
    let count: u64 = redis.zcard(key(user)).await?;
    Ok(count > 0)
}

pub async fn online_many(state: &AppState, users: &[Id]) -> AppResult<Vec<bool>> {
    if users.is_empty() {
        return Ok(vec![]);
    }
    let min = now() - STALE_SECS;
    let mut pipe = redis::pipe();
    for u in users {
        pipe.zcount(key(*u), min, "+inf");
    }
    let counts: Vec<u64> = pipe.query_async(&mut state.redis()).await?;
    Ok(counts.into_iter().map(|c| c > 0).collect())
}

/// Returns true when this socket brought the user online.
pub async fn connect(state: &AppState, user: Id, conn_key: &str) -> AppResult<bool> {
    let was_online = is_online(state, user).await?;
    touch(state, user, conn_key).await?;
    Ok(!was_online)
}

pub async fn touch(state: &AppState, user: Id, conn_key: &str) -> AppResult<()> {
    let mut redis = state.redis();
    let _: () = redis.zadd(key(user), conn_key, now()).await?;
    let _: () = redis.expire(key(user), STALE_SECS * 2).await?;
    Ok(())
}

/// Returns true when this socket was the user's last one.
pub async fn disconnect(state: &AppState, user: Id, conn_key: &str) -> AppResult<bool> {
    let _: () = state.redis().zrem(key(user), conn_key).await?;
    Ok(!is_online(state, user).await?)
}
