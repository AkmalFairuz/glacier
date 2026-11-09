use std::collections::HashMap;

use chrono::Utc;

use crate::cache::{self, DEFAULT_TTL};
use crate::channels::{repo as channels_repo, Channel, ChannelRow, ChannelType};
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::state::AppState;
use crate::users;

fn participants_key(channel: Id) -> String {
    format!("glacier:dmp:{channel}")
}

pub async fn participants(state: &AppState, channel: Id) -> AppResult<Vec<Id>> {
    cache::remember(state, &participants_key(channel), DEFAULT_TTL, || async {
        let rows: Vec<(Id,)> =
            sqlx::query_as("SELECT user_id FROM dm_participants WHERE channel_id = ? ORDER BY user_id")
                .bind(channel)
                .fetch_all(&state.db.writer)
                .await?;
        Ok(rows.into_iter().map(|(u,)| u).collect())
    })
    .await
}

/// Everyone who shares a DM or group DM with `user`: they see this user's presence.
pub async fn contacts(state: &AppState, user: Id) -> AppResult<Vec<Id>> {
    let rows: Vec<(Id,)> = sqlx::query_as(
        "SELECT DISTINCT b.user_id FROM dm_participants a \
         JOIN dm_participants b ON b.channel_id = a.channel_id AND b.user_id <> a.user_id \
         WHERE a.user_id = ?",
    )
    .bind(user)
    .fetch_all(&state.db.reader)
    .await?;
    Ok(rows.into_iter().map(|(u,)| u).collect())
}

pub async fn is_participant(state: &AppState, channel: Id, user: Id) -> AppResult<bool> {
    Ok(participants(state, channel).await?.contains(&user))
}

async fn forget(state: &AppState, channel: Id) -> AppResult<()> {
    cache::del(state, &participants_key(channel)).await?;
    channels_repo::forget(state, channel).await
}

/// Builds full channel objects (with recipients) for DM rows.
async fn with_recipients(state: &AppState, rows: Vec<ChannelRow>) -> AppResult<Vec<Channel>> {
    let mut parts: HashMap<Id, Vec<Id>> = HashMap::new();
    for row in &rows {
        parts.insert(row.id, participants(state, row.id).await?);
    }
    let mut all: Vec<Id> = parts.values().flatten().copied().collect();
    all.sort();
    all.dedup();
    let users: HashMap<Id, users::User> = users::repo::get_many(state, &all)
        .await?
        .into_iter()
        .map(|u| (u.id, u))
        .collect();
    Ok(rows
        .into_iter()
        .map(|row| {
            let recipients = parts
                .remove(&row.id)
                .unwrap_or_default()
                .iter()
                .filter_map(|u| users.get(u).cloned())
                .collect();
            Channel::from_row(row, vec![], recipients)
        })
        .collect())
}

pub async fn list(state: &AppState, user: Id) -> AppResult<Vec<Channel>> {
    let rows = sqlx::query_as::<_, ChannelRow>(
        "SELECT c.id, c.server_id, c.type, c.name, c.topic, c.parent_id, c.position, c.user_limit, c.owner_id, c.last_message_id \
         FROM channels c JOIN dm_participants p ON p.channel_id = c.id AND p.user_id = ? \
         ORDER BY COALESCE(c.last_message_id, c.id) DESC",
    )
    .bind(user)
    .fetch_all(&state.db.writer)
    .await?;
    with_recipients(state, rows).await
}

pub async fn get(state: &AppState, channel: Id) -> AppResult<Channel> {
    let row = channels_repo::get(state, channel).await?;
    if !row.kind.is_dm() {
        return Err(AppError::NotFound("channel"));
    }
    with_recipients(state, vec![row])
        .await?
        .pop()
        .ok_or(AppError::NotFound("channel"))
}

pub async fn find_direct(state: &AppState, a: Id, b: Id) -> AppResult<Option<Id>> {
    let row: Option<(Id,)> = sqlx::query_as(
        "SELECT c.id FROM channels c \
         JOIN dm_participants pa ON pa.channel_id = c.id AND pa.user_id = ? \
         JOIN dm_participants pb ON pb.channel_id = c.id AND pb.user_id = ? \
         WHERE c.type = 'dm' LIMIT 1",
    )
    .bind(a)
    .bind(b)
    .fetch_optional(&state.db.writer)
    .await?;
    Ok(row.map(|(id,)| id))
}

pub async fn create(
    state: &AppState,
    kind: ChannelType,
    owner: Option<Id>,
    name: Option<&str>,
    users: &[Id],
) -> AppResult<Id> {
    let id = state.ids.next();
    let mut tx = state.db.writer.begin().await?;
    sqlx::query("INSERT INTO channels (id, server_id, type, name, owner_id, created_at) VALUES (?, NULL, ?, ?, ?, ?)")
        .bind(id)
        .bind(kind)
        .bind(name)
        .bind(owner)
        .bind(Utc::now())
        .execute(&mut *tx)
        .await?;
    for user in users {
        sqlx::query("INSERT INTO dm_participants (channel_id, user_id) VALUES (?, ?)")
            .bind(id)
            .bind(user)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(id)
}

pub async fn rename(state: &AppState, channel: Id, name: &str) -> AppResult<()> {
    sqlx::query("UPDATE channels SET name = ? WHERE id = ?")
        .bind(name)
        .bind(channel)
        .execute(&state.db.writer)
        .await?;
    forget(state, channel).await
}

pub async fn add_participant(state: &AppState, channel: Id, user: Id) -> AppResult<()> {
    sqlx::query("INSERT IGNORE INTO dm_participants (channel_id, user_id) VALUES (?, ?)")
        .bind(channel)
        .bind(user)
        .execute(&state.db.writer)
        .await?;
    forget(state, channel).await
}

/// Removes the user; deletes the channel when nobody is left.
pub async fn remove_participant(state: &AppState, channel: Id, user: Id) -> AppResult<Vec<Id>> {
    sqlx::query("DELETE FROM dm_participants WHERE channel_id = ? AND user_id = ?")
        .bind(channel)
        .bind(user)
        .execute(&state.db.writer)
        .await?;
    forget(state, channel).await?;
    let remaining = participants(state, channel).await?;
    if remaining.is_empty() {
        sqlx::query("DELETE FROM channels WHERE id = ?")
            .bind(channel)
            .execute(&state.db.writer)
            .await?;
    } else {
        // Hand group ownership to someone who stayed.
        sqlx::query("UPDATE channels SET owner_id = ? WHERE id = ? AND owner_id = ?")
            .bind(remaining[0])
            .bind(channel)
            .bind(user)
            .execute(&state.db.writer)
            .await?;
    }
    forget(state, channel).await?;
    Ok(remaining)
}
