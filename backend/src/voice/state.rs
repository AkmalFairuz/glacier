//! Voice room membership in Redis, shared by all replicas.
//! `voice:user:{uid}` holds the user's state (with a TTL refreshed by the
//! gateway heartbeat); `voice:room:{cid}` is the set of user ids in a room.
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::AppResult;
use crate::id::Id;
use crate::state::AppState;

const TTL_SECS: u64 = 90;

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
pub struct VoiceState {
    pub user_id: Id,
    pub channel_id: Id,
    pub server_id: Option<Id>,
    pub muted: bool,
    pub deafened: bool,
    pub video: bool,
    pub screen: bool,
}

#[derive(Serialize, Deserialize)]
struct Stored {
    state: VoiceState,
    conn: String,
}

fn user_key(user: Id) -> String {
    format!("glacier:voice:user:{user}")
}

fn room_key(channel: Id) -> String {
    format!("glacier:voice:room:{channel}")
}

async fn load(state: &AppState, user: Id) -> AppResult<Option<Stored>> {
    let raw: Option<String> = state.redis().get(user_key(user)).await?;
    Ok(raw.and_then(|r| serde_json::from_str(&r).ok()))
}

async fn store(state: &AppState, stored: &Stored) -> AppResult<()> {
    let mut redis = state.redis();
    let _: () = redis
        .set_ex(user_key(stored.state.user_id), serde_json::to_string(stored)?, TTL_SECS)
        .await?;
    let _: () = redis
        .sadd(room_key(stored.state.channel_id), stored.state.user_id.0)
        .await?;
    let _: () = redis.expire(room_key(stored.state.channel_id), 86_400).await?;
    Ok(())
}

pub async fn current(state: &AppState, user: Id) -> AppResult<Option<VoiceState>> {
    Ok(load(state, user).await?.map(|s| s.state))
}

/// Live members of a room; stale entries (expired user keys) are pruned.
pub async fn members(state: &AppState, channel: Id) -> AppResult<Vec<VoiceState>> {
    let mut redis = state.redis();
    let ids: Vec<u64> = redis.smembers(room_key(channel)).await?;
    let mut out = Vec::with_capacity(ids.len());
    for id in ids {
        match load(state, Id(id)).await? {
            Some(s) if s.state.channel_id == channel => out.push(s.state),
            _ => {
                let _: () = redis.srem(room_key(channel), id).await?;
            }
        }
    }
    Ok(out)
}

pub async fn join(state: &AppState, voice: VoiceState, conn: &str) -> AppResult<()> {
    store(
        state,
        &Stored {
            state: voice,
            conn: conn.to_string(),
        },
    )
    .await
}

/// Removes the user's voice state. With `conn`, only if that socket owns it.
pub async fn leave(state: &AppState, user: Id, conn: Option<&str>) -> AppResult<Option<VoiceState>> {
    let Some(stored) = load(state, user).await? else {
        return Ok(None);
    };
    if conn.is_some_and(|c| c != stored.conn) {
        return Ok(None);
    }
    let mut redis = state.redis();
    let _: () = redis.del(user_key(user)).await?;
    let _: () = redis.srem(room_key(stored.state.channel_id), user.0).await?;
    Ok(Some(stored.state))
}

pub async fn update_flags(
    state: &AppState,
    user: Id,
    conn: &str,
    f: impl FnOnce(&mut VoiceState),
) -> AppResult<Option<VoiceState>> {
    let Some(mut stored) = load(state, user).await? else {
        return Ok(None);
    };
    if stored.conn != conn {
        return Ok(None);
    }
    f(&mut stored.state);
    store(state, &stored).await?;
    Ok(Some(stored.state))
}

pub async fn refresh(state: &AppState, user: Id, conn: &str) -> AppResult<()> {
    if let Some(stored) = load(state, user).await? {
        if stored.conn == conn {
            let _: () = state.redis().expire(user_key(user), TTL_SECS as i64).await?;
        }
    }
    Ok(())
}
