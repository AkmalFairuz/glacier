//! Presence shared by all replicas.
//!
//! Live sockets: a Redis sorted set per user with one entry per socket, scored by last heartbeat.
//! Idle sockets: a Redis set of the socket keys whose tab reported inactivity.
//! The chosen status and custom status are stored on `users`.
//!
//! What others see: offline with no live socket or when invisible; otherwise the chosen status,
//! except that "online" becomes idle when every open tab is idle.
use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::MySqlPool;
use utoipa::ToSchema;

use crate::error::AppResult;
use crate::id::Id;
use crate::state::AppState;
use crate::{dms, servers};

use super::{publish, Event, Target};

const STALE_SECS: i64 = 90;

/// What other people see.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Online,
    Idle,
    Dnd,
    Offline,
}

/// What the user chose. Invisible appears offline to everyone else.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StatusSetting {
    Online,
    Idle,
    Dnd,
    Invisible,
}

crate::db::sql_string_enum!(StatusSetting {
    Online => "online",
    Idle => "idle",
    Dnd => "dnd",
    Invisible => "invisible",
});

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct CustomStatus {
    /// Up to 128 characters.
    pub text: Option<String>,
    /// One emoji.
    pub emoji: Option<String>,
    /// Clears itself after this time; `null` keeps it until changed.
    pub expires_at: Option<DateTime<Utc>>,
}

/// A user's presence as others see it.
#[derive(Clone, Debug, PartialEq, Serialize, ToSchema)]
pub struct Presence {
    pub status: Status,
    /// Hidden while offline or invisible.
    pub custom_status: Option<CustomStatus>,
}

impl Presence {
    pub const OFFLINE: Presence = Presence {
        status: Status::Offline,
        custom_status: None,
    };

    pub fn online(&self) -> bool {
        self.status != Status::Offline
    }
}

/// The caller's own choice, for the status picker.
#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct PresenceSettings {
    pub status: StatusSetting,
    pub custom_status: Option<CustomStatus>,
}

fn key(user: Id) -> String {
    format!("glacier:presence:{user}")
}

fn idle_key(user: Id) -> String {
    format!("glacier:presence:idle:{user}")
}

fn now() -> i64 {
    Utc::now().timestamp()
}

type SettingRow = (Id, StatusSetting, Option<String>, Option<String>, Option<DateTime<Utc>>);

/// Chosen status and unexpired custom status for each user.
async fn settings_many(pool: &MySqlPool, users: &[Id]) -> AppResult<HashMap<Id, PresenceSettings>> {
    if users.is_empty() {
        return Ok(HashMap::new());
    }
    let sql = format!(
        "SELECT id, status, custom_status_text, custom_status_emoji, custom_status_expires_at FROM users WHERE id IN ({})",
        vec!["?"; users.len()].join(",")
    );
    let mut q = sqlx::query_as::<_, SettingRow>(&sql);
    for u in users {
        q = q.bind(*u);
    }
    let now = Utc::now();
    Ok(q.fetch_all(pool)
        .await?
        .into_iter()
        .map(|(id, status, text, emoji, expires_at)| {
            let live = (text.is_some() || emoji.is_some()) && expires_at.is_none_or(|t| t > now);
            let custom_status = live.then_some(CustomStatus {
                text,
                emoji,
                expires_at,
            });
            (id, PresenceSettings { status, custom_status })
        })
        .collect())
}

pub async fn settings(state: &AppState, user: Id) -> AppResult<PresenceSettings> {
    settings_many(&state.db.writer, &[user])
        .await?
        .remove(&user)
        .ok_or(crate::error::AppError::NotFound("user"))
}

/// Presence of each user, in order. `pool` picks primary or replica for the stored settings.
pub async fn presence_many(state: &AppState, pool: &MySqlPool, users: &[Id]) -> AppResult<Vec<Presence>> {
    if users.is_empty() {
        return Ok(vec![]);
    }
    let min = now() - STALE_SECS;
    let mut pipe = redis::pipe();
    for u in users {
        pipe.zrangebyscore(key(*u), min, "+inf").smembers(idle_key(*u));
    }
    let sockets: Vec<(Vec<String>, HashSet<String>)> = pipe.query_async(&mut state.redis()).await?;
    let settings = settings_many(pool, users).await?;
    Ok(users
        .iter()
        .zip(sockets)
        .map(|(user, (live, idle))| {
            let Some(setting) = settings.get(user) else {
                return Presence::OFFLINE;
            };
            let status = effective(setting.status, &live, &idle);
            let custom_status = (status != Status::Offline)
                .then(|| setting.custom_status.clone())
                .flatten();
            Presence { status, custom_status }
        })
        .collect())
}

/// What others see, from the chosen status and the user's live and idle sockets.
fn effective(setting: StatusSetting, live: &[String], idle: &HashSet<String>) -> Status {
    match setting {
        _ if live.is_empty() => Status::Offline,
        StatusSetting::Invisible => Status::Offline,
        StatusSetting::Dnd => Status::Dnd,
        StatusSetting::Idle => Status::Idle,
        StatusSetting::Online if live.iter().all(|s| idle.contains(s)) => Status::Idle,
        StatusSetting::Online => Status::Online,
    }
}

/// Fresh presence of one user (stored settings from the primary).
pub async fn presence_of(state: &AppState, user: Id) -> AppResult<Presence> {
    Ok(presence_many(state, &state.db.writer, &[user])
        .await?
        .pop()
        .unwrap_or(Presence::OFFLINE))
}

pub async fn touch(state: &AppState, user: Id, conn_key: &str) -> AppResult<()> {
    let mut redis = state.redis();
    let _: () = redis.zadd(key(user), conn_key, now()).await?;
    let _: () = redis.expire(key(user), STALE_SECS * 2).await?;
    let _: () = redis.expire(idle_key(user), STALE_SECS * 2).await?;
    Ok(())
}

pub async fn disconnect(state: &AppState, user: Id, conn_key: &str) -> AppResult<()> {
    let mut redis = state.redis();
    let _: () = redis.zrem(key(user), conn_key).await?;
    let _: () = redis.srem(idle_key(user), conn_key).await?;
    Ok(())
}

/// Marks one tab as idle (no input for a while) or active again.
pub async fn set_idle(state: &AppState, user: Id, conn_key: &str, idle: bool) -> AppResult<()> {
    let mut redis = state.redis();
    if idle {
        let _: () = redis.sadd(idle_key(user), conn_key).await?;
        let _: () = redis.expire(idle_key(user), STALE_SECS * 2).await?;
    } else {
        let _: () = redis.srem(idle_key(user), conn_key).await?;
    }
    Ok(())
}

pub fn update_event(user: Id, presence: &Presence) -> Event {
    Event::new(
        "PRESENCE_UPDATE",
        json!({
            "user_id": user,
            "online": presence.online(),
            "status": presence.status,
            "custom_status": presence.custom_status,
        }),
    )
}

/// Tells everyone who can see `user` (members of shared servers and DM contacts) about a change.
/// Does nothing when the visible presence is the same as `before`.
pub async fn broadcast_if_changed(state: &AppState, user: Id, before: &Presence) {
    let after = match presence_of(state, user).await {
        Ok(p) => p,
        Err(e) => return tracing::warn!(error = %e, "presence: could not compute presence"),
    };
    if after == *before {
        return;
    }
    let event = update_event(user, &after);
    match servers::repo::ids_for_user(state, user).await {
        Ok(ids) if !ids.is_empty() => publish(state, Target::Servers(ids), event.clone()).await,
        Ok(_) => {}
        Err(e) => tracing::warn!(error = %e, "presence: could not load servers"),
    }
    match dms::repo::contacts(state, user).await {
        Ok(contacts) if !contacts.is_empty() => publish(state, Target::Users(contacts), event).await,
        Ok(_) => {}
        Err(e) => tracing::warn!(error = %e, "presence: could not load DM contacts"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sockets(names: &[&str]) -> Vec<String> {
        names.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn no_socket_is_offline_whatever_the_setting() {
        for setting in [StatusSetting::Online, StatusSetting::Dnd, StatusSetting::Idle] {
            assert_eq!(effective(setting, &[], &HashSet::new()), Status::Offline);
        }
    }

    #[test]
    fn invisible_looks_offline() {
        assert_eq!(
            effective(StatusSetting::Invisible, &sockets(&["a"]), &HashSet::new()),
            Status::Offline
        );
    }

    #[test]
    fn online_turns_idle_only_when_every_tab_is_idle() {
        let live = sockets(&["a", "b"]);
        let one_idle = HashSet::from(["a".to_string()]);
        let all_idle = HashSet::from(["a".to_string(), "b".to_string()]);
        assert_eq!(effective(StatusSetting::Online, &live, &one_idle), Status::Online);
        assert_eq!(effective(StatusSetting::Online, &live, &all_idle), Status::Idle);
    }

    #[test]
    fn dnd_stays_dnd_while_idle() {
        let idle = HashSet::from(["a".to_string()]);
        assert_eq!(effective(StatusSetting::Dnd, &sockets(&["a"]), &idle), Status::Dnd);
    }
}
