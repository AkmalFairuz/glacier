use chrono::Utc;

use crate::cache::{self, DEFAULT_TTL};
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::permissions::TargetType;
use crate::state::AppState;

use super::models::{ChannelRow, ChannelType};

pub const COLUMNS: &str =
    "id, server_id, type, name, topic, parent_id, position, user_limit, owner_id, last_message_id";

fn key(id: Id) -> String {
    format!("glacier:channel:{id}")
}

pub async fn get(state: &AppState, id: Id) -> AppResult<ChannelRow> {
    cache::remember(state, &key(id), DEFAULT_TTL, || async {
        sqlx::query_as::<_, ChannelRow>(&format!("SELECT {COLUMNS} FROM channels WHERE id = ?"))
            .bind(id)
            .fetch_optional(&state.db.writer)
            .await?
            .ok_or(AppError::NotFound("channel"))
    })
    .await
}

pub async fn forget(state: &AppState, id: Id) -> AppResult<()> {
    cache::del(state, &key(id)).await
}

/// Read from the primary: clients fetch this right after creating a server or channel.
pub async fn list_for_server(state: &AppState, server: Id) -> AppResult<Vec<ChannelRow>> {
    Ok(sqlx::query_as::<_, ChannelRow>(&format!(
        "SELECT {COLUMNS} FROM channels WHERE server_id = ? ORDER BY position, id"
    ))
    .bind(server)
    .fetch_all(&state.db.writer)
    .await?)
}

pub async fn voice_channel_ids(state: &AppState, server: Id) -> AppResult<Vec<Id>> {
    let rows: Vec<(Id,)> = sqlx::query_as("SELECT id FROM channels WHERE server_id = ? AND type = 'voice'")
        .bind(server)
        .fetch_all(&state.db.writer)
        .await?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}

pub async fn create(
    state: &AppState,
    server: Id,
    kind: ChannelType,
    name: &str,
    parent: Option<Id>,
    topic: Option<&str>,
) -> AppResult<Id> {
    let id = state.ids.next();
    let (next,): (i64,) = sqlx::query_as(
        "SELECT CAST(COALESCE(MAX(position), -1) + 1 AS SIGNED) FROM channels WHERE server_id = ? AND parent_id <=> ?",
    )
    .bind(server)
    .bind(parent)
    .fetch_one(&state.db.writer)
    .await?;
    sqlx::query("INSERT INTO channels (id, server_id, type, name, topic, parent_id, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id)
        .bind(server)
        .bind(kind)
        .bind(name)
        .bind(topic)
        .bind(parent)
        .bind(next as i32)
        .bind(Utc::now())
        .execute(&state.db.writer)
        .await?;
    Ok(id)
}

pub async fn update(state: &AppState, row: &ChannelRow) -> AppResult<()> {
    sqlx::query("UPDATE channels SET name = ?, topic = ?, parent_id = ?, position = ?, user_limit = ? WHERE id = ?")
        .bind(&row.name)
        .bind(&row.topic)
        .bind(row.parent_id)
        .bind(row.position)
        .bind(row.user_limit)
        .bind(row.id)
        .execute(&state.db.writer)
        .await?;
    forget(state, row.id).await
}

pub async fn delete(state: &AppState, id: Id) -> AppResult<()> {
    // Children of a deleted category become top-level.
    sqlx::query("UPDATE channels SET parent_id = NULL WHERE parent_id = ?")
        .bind(id)
        .execute(&state.db.writer)
        .await?;
    sqlx::query("DELETE FROM channels WHERE id = ?")
        .bind(id)
        .execute(&state.db.writer)
        .await?;
    forget(state, id).await
}

pub async fn put_overwrite(
    state: &AppState,
    channel: Id,
    target: Id,
    kind: TargetType,
    allow: u64,
    deny: u64,
) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO channel_overwrites (channel_id, target_id, target_type, allow_bits, deny_bits) VALUES (?, ?, ?, ?, ?) \
         ON DUPLICATE KEY UPDATE target_type = VALUES(target_type), allow_bits = VALUES(allow_bits), deny_bits = VALUES(deny_bits)",
    )
    .bind(channel)
    .bind(target)
    .bind(kind)
    .bind(allow)
    .bind(deny)
    .execute(&state.db.writer)
    .await?;
    Ok(())
}

pub async fn delete_overwrite(state: &AppState, channel: Id, target: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM channel_overwrites WHERE channel_id = ? AND target_id = ?")
        .bind(channel)
        .bind(target)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}

/// Applies a new order atomically.
pub async fn reorder(state: &AppState, moves: &[(Id, i32, Option<Id>)]) -> AppResult<()> {
    let mut tx = state.db.writer.begin().await?;
    for (id, position, parent) in moves {
        sqlx::query("UPDATE channels SET position = ?, parent_id = ? WHERE id = ?")
            .bind(position)
            .bind(parent)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    for (id, _, _) in moves {
        forget(state, *id).await?;
    }
    Ok(())
}
