use chrono::Utc;

use crate::error::AppResult;
use crate::id::Id;
use crate::state::AppState;

use super::models::{ChannelHead, ReadReceipt, ReadState, UnreadCount};

/// Moves the read position forward only; returns the stored position.
pub async fn ack(state: &AppState, user: Id, channel: Id, message: Id) -> AppResult<Id> {
    sqlx::query(
        "INSERT INTO read_states (user_id, channel_id, last_read_message_id, updated_at) VALUES (?, ?, ?, ?) \
         ON DUPLICATE KEY UPDATE last_read_message_id = GREATEST(last_read_message_id, VALUES(last_read_message_id)), \
         updated_at = VALUES(updated_at)",
    )
    .bind(user)
    .bind(channel)
    .bind(message)
    .bind(Utc::now())
    .execute(&state.db.writer)
    .await?;
    let (stored,): (Id,) =
        sqlx::query_as("SELECT last_read_message_id FROM read_states WHERE user_id = ? AND channel_id = ?")
            .bind(user)
            .bind(channel)
            .fetch_one(&state.db.writer)
            .await?;
    Ok(stored)
}

pub async fn for_user(state: &AppState, user: Id) -> AppResult<Vec<ReadState>> {
    Ok(
        sqlx::query_as::<_, ReadState>("SELECT channel_id, last_read_message_id FROM read_states WHERE user_id = ?")
            .bind(user)
            .fetch_all(&state.db.writer)
            .await?,
    )
}

pub async fn receipts(state: &AppState, channel: Id, except: Id) -> AppResult<Vec<ReadReceipt>> {
    Ok(sqlx::query_as::<_, ReadReceipt>(
        "SELECT user_id, last_read_message_id FROM read_states WHERE channel_id = ? AND user_id <> ?",
    )
    .bind(channel)
    .bind(except)
    .fetch_all(&state.db.writer)
    .await?)
}

/// Latest message of every text channel in the given servers.
pub async fn server_heads(state: &AppState, servers: &[Id]) -> AppResult<Vec<ChannelHead>> {
    if servers.is_empty() {
        return Ok(vec![]);
    }
    let placeholders = vec!["?"; servers.len()].join(",");
    let sql = format!(
        "SELECT id AS channel_id, server_id, last_message_id FROM channels \
         WHERE server_id IN ({placeholders}) AND type = 'text' AND last_message_id IS NOT NULL"
    );
    let mut q = sqlx::query_as::<_, ChannelHead>(&sql);
    for s in servers {
        q = q.bind(*s);
    }
    Ok(q.fetch_all(&state.db.writer).await?)
}

/// Unread counts for the user's DMs (capped at 100 per channel; the UI shows 99+).
pub async fn dm_unread_counts(state: &AppState, user: Id) -> AppResult<Vec<UnreadCount>> {
    let rows = sqlx::query_as::<_, UnreadCount>(
        "SELECT m.channel_id, COUNT(*) AS count \
         FROM dm_participants p \
         JOIN messages m ON m.channel_id = p.channel_id AND m.author_id <> p.user_id \
         LEFT JOIN read_states r ON r.user_id = p.user_id AND r.channel_id = p.channel_id \
         WHERE p.user_id = ? AND m.id > COALESCE(r.last_read_message_id, 0) \
         GROUP BY m.channel_id",
    )
    .bind(user)
    .fetch_all(&state.db.writer)
    .await?;
    Ok(rows
        .into_iter()
        .map(|c| UnreadCount {
            count: c.count.min(100),
            ..c
        })
        .collect())
}
