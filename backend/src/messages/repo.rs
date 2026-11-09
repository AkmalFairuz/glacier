use std::collections::HashMap;

use chrono::Utc;
use sqlx::MySqlPool;

use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::state::AppState;
use crate::users;

use super::models::{Attachment, Message, MessageRow, Reaction};

const COLUMNS: &str = "id, channel_id, author_id, content, edited_at, created_at";

fn placeholders(n: usize) -> String {
    vec!["?"; n].join(",")
}

/// Joins authors, attachments and reactions onto message rows.
pub async fn hydrate(state: &AppState, pool: &MySqlPool, rows: Vec<MessageRow>) -> AppResult<Vec<Message>> {
    if rows.is_empty() {
        return Ok(vec![]);
    }
    let ids: Vec<Id> = rows.iter().map(|r| r.id).collect();
    let mut author_ids: Vec<Id> = rows.iter().map(|r| r.author_id).collect();
    author_ids.sort();
    author_ids.dedup();
    let authors: HashMap<Id, users::User> = users::repo::get_many(state, &author_ids)
        .await?
        .into_iter()
        .map(|u| (u.id, u))
        .collect();

    let sql = format!(
        "SELECT message_id, id, url, filename, content_type, size, width, height FROM attachments WHERE message_id IN ({}) ORDER BY id",
        placeholders(ids.len())
    );
    let mut q = sqlx::query_as::<_, (Id, Id, String, String, String, u64, Option<u32>, Option<u32>)>(&sql);
    for id in &ids {
        q = q.bind(*id);
    }
    let mut attachments: HashMap<Id, Vec<Attachment>> = HashMap::new();
    for (mid, id, url, filename, content_type, size, width, height) in q.fetch_all(pool).await? {
        attachments.entry(mid).or_default().push(Attachment {
            id,
            url,
            filename,
            content_type,
            size,
            width,
            height,
        });
    }

    let sql = format!(
        "SELECT message_id, CONVERT(emoji USING utf8mb4) AS emoji, user_id FROM reactions WHERE message_id IN ({}) ORDER BY created_at",
        placeholders(ids.len())
    );
    let mut q = sqlx::query_as::<_, (Id, String, Id)>(&sql);
    for id in &ids {
        q = q.bind(*id);
    }
    let mut reactions: HashMap<Id, Vec<Reaction>> = HashMap::new();
    for (mid, emoji, user) in q.fetch_all(pool).await? {
        let list = reactions.entry(mid).or_default();
        match list.iter_mut().find(|r| r.emoji == emoji) {
            Some(r) => r.user_ids.push(user),
            None => list.push(Reaction {
                emoji,
                user_ids: vec![user],
            }),
        }
    }

    Ok(rows
        .into_iter()
        .filter_map(|r| {
            Some(Message {
                author: authors.get(&r.author_id)?.clone(),
                attachments: attachments.remove(&r.id).unwrap_or_default(),
                reactions: reactions.remove(&r.id).unwrap_or_default(),
                id: r.id,
                channel_id: r.channel_id,
                content: r.content,
                edited_at: r.edited_at,
                created_at: r.created_at,
            })
        })
        .collect())
}

/// Page of history (oldest -> newest), served from the read replica.
pub async fn list(state: &AppState, channel: Id, before: Option<Id>, limit: u32) -> AppResult<Vec<Message>> {
    let rows = sqlx::query_as::<_, MessageRow>(&format!(
        "SELECT {COLUMNS} FROM messages WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT ?"
    ))
    .bind(channel)
    .bind(before.unwrap_or(Id(u64::MAX)))
    .bind(limit)
    .fetch_all(&state.db.reader)
    .await?;
    let mut messages = hydrate(state, &state.db.reader, rows).await?;
    messages.reverse();
    Ok(messages)
}

pub async fn get(state: &AppState, channel: Id, id: Id) -> AppResult<Message> {
    let rows = sqlx::query_as::<_, MessageRow>(&format!(
        "SELECT {COLUMNS} FROM messages WHERE id = ? AND channel_id = ?"
    ))
    .bind(id)
    .bind(channel)
    .fetch_all(&state.db.writer)
    .await?;
    hydrate(state, &state.db.writer, rows)
        .await?
        .pop()
        .ok_or(AppError::NotFound("message"))
}

pub async fn author_of(state: &AppState, channel: Id, id: Id) -> AppResult<Id> {
    let row: Option<(Id,)> = sqlx::query_as("SELECT author_id FROM messages WHERE id = ? AND channel_id = ?")
        .bind(id)
        .bind(channel)
        .fetch_optional(&state.db.writer)
        .await?;
    row.map(|(a,)| a).ok_or(AppError::NotFound("message"))
}

pub async fn insert(state: &AppState, channel: Id, author: Id, content: &str, attachments: &[Id]) -> AppResult<Id> {
    let id = state.ids.next();
    let mut tx = state.db.writer.begin().await?;
    sqlx::query("INSERT INTO messages (id, channel_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id)
        .bind(channel)
        .bind(author)
        .bind(content)
        .bind(Utc::now())
        .execute(&mut *tx)
        .await?;
    for att in attachments {
        let res = sqlx::query(
            "UPDATE attachments SET message_id = ? WHERE id = ? AND channel_id = ? AND uploader_id = ? AND message_id IS NULL",
        )
        .bind(id)
        .bind(att)
        .bind(channel)
        .bind(author)
        .execute(&mut *tx)
        .await?;
        if res.rows_affected() != 1 {
            return Err(AppError::bad("invalid attachment id"));
        }
    }
    sqlx::query("UPDATE channels SET last_message_id = ? WHERE id = ?")
        .bind(id)
        .bind(channel)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(id)
}

pub async fn edit(state: &AppState, id: Id, content: &str) -> AppResult<()> {
    sqlx::query("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?")
        .bind(content)
        .bind(Utc::now())
        .bind(id)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}

pub async fn delete(state: &AppState, id: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM messages WHERE id = ?")
        .bind(id)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}

/// Returns true when the reaction was newly added.
pub async fn add_reaction(state: &AppState, message: Id, user: Id, emoji: &str) -> AppResult<bool> {
    let res = sqlx::query("INSERT IGNORE INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)")
        .bind(message)
        .bind(user)
        .bind(emoji)
        .bind(Utc::now())
        .execute(&state.db.writer)
        .await?;
    Ok(res.rows_affected() == 1)
}

pub async fn remove_reaction(state: &AppState, message: Id, user: Id, emoji: &str) -> AppResult<bool> {
    let res = sqlx::query("DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?")
        .bind(message)
        .bind(user)
        .bind(emoji)
        .execute(&state.db.writer)
        .await?;
    Ok(res.rows_affected() == 1)
}
