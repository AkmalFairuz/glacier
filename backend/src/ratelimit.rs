//! Fixed-window rate limiter shared by all replicas through Redis.
use redis::AsyncCommands;

use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::state::AppState;

pub fn window_key(scope: &str, subject: &str, window_secs: u64, now_secs: u64) -> String {
    format!("glacier:rl:{scope}:{subject}:{}", now_secs / window_secs)
}

pub async fn check(state: &AppState, scope: &str, subject: &str, limit: u64, window_secs: u64) -> AppResult<()> {
    let now = chrono::Utc::now().timestamp() as u64;
    let key = window_key(scope, subject, window_secs, now);
    let mut redis = state.redis();
    let count: u64 = redis.incr(&key, 1).await?;
    if count == 1 {
        let _: () = redis.expire(&key, window_secs as i64).await?;
    }
    if count > limit {
        metrics::counter!("glacier_rate_limited_total", "scope" => scope.to_string()).increment(1);
        return Err(AppError::RateLimited);
    }
    Ok(())
}

/// Slowmode: one message per `secs` per member in a channel. Claims the slot atomically, so two
/// sends racing on different replicas cannot both get through.
pub async fn slowmode(state: &AppState, channel: Id, user: Id, secs: u32) -> AppResult<()> {
    let key = format!("glacier:slowmode:{channel}:{user}");
    let mut redis = state.redis();
    let claimed: Option<String> = redis::cmd("SET")
        .arg(&key)
        .arg(1)
        .arg("NX")
        .arg("EX")
        .arg(secs)
        .query_async(&mut redis)
        .await?;
    if claimed.is_some() {
        return Ok(());
    }
    let ttl: i64 = redis.ttl(&key).await?;
    metrics::counter!("glacier_rate_limited_total", "scope" => "slowmode").increment(1);
    Err(AppError::Slowmode(ttl.max(1) as u64))
}

#[cfg(test)]
mod tests {
    use super::window_key;

    #[test]
    fn same_window_same_key() {
        assert_eq!(window_key("login", "bob", 60, 120), window_key("login", "bob", 60, 179));
        assert_ne!(window_key("login", "bob", 60, 179), window_key("login", "bob", 60, 180));
    }
}
