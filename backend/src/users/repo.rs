use crate::gateway::presence::{CustomStatus, StatusSetting};
use sqlx::MySqlPool;

use crate::cache;
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::state::AppState;

use super::models::User;

const COLUMNS: &str = "id, username, display_name, avatar_url, bio, banner_color, created_at";

pub async fn get(state: &AppState, id: Id) -> AppResult<User> {
    cache::remember(state, &cache::user_key(id), cache::DEFAULT_TTL, || async {
        sqlx::query_as::<_, User>(&format!("SELECT {COLUMNS} FROM users WHERE id = ?"))
            .bind(id)
            .fetch_optional(&state.db.writer)
            .await?
            .ok_or(AppError::NotFound("user"))
    })
    .await
}

/// Batch fetch, preserving no particular order. Reads the replica and falls
/// back to the primary for ids the replica has not received yet (new users).
pub async fn get_many(state: &AppState, ids: &[Id]) -> AppResult<Vec<User>> {
    let mut users = fetch_many(&state.db.reader, ids).await?;
    if users.len() < ids.len() {
        let missing: Vec<Id> = ids
            .iter()
            .filter(|id| !users.iter().any(|u| u.id == **id))
            .copied()
            .collect();
        users.extend(fetch_many(&state.db.writer, &missing).await?);
    }
    Ok(users)
}

async fn fetch_many(pool: &MySqlPool, ids: &[Id]) -> AppResult<Vec<User>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    let placeholders = vec!["?"; ids.len()].join(",");
    let sql = format!("SELECT {COLUMNS} FROM users WHERE id IN ({placeholders})");
    let mut q = sqlx::query_as::<_, User>(&sql);
    for id in ids {
        q = q.bind(*id);
    }
    Ok(q.fetch_all(pool).await?)
}

pub struct ProfileFields<'a> {
    pub display_name: &'a str,
    pub avatar_url: Option<&'a str>,
    pub bio: Option<&'a str>,
    pub banner_color: Option<u32>,
}

pub async fn update(state: &AppState, id: Id, f: ProfileFields<'_>) -> AppResult<User> {
    sqlx::query("UPDATE users SET display_name = ?, avatar_url = ?, bio = ?, banner_color = ? WHERE id = ?")
        .bind(f.display_name)
        .bind(f.avatar_url)
        .bind(f.bio)
        .bind(f.banner_color)
        .bind(id)
        .execute(&state.db.writer)
        .await?;
    cache::del(state, &cache::user_key(id)).await?;
    get(state, id).await
}

pub async fn search(state: &AppState, prefix: &str, exclude: Id) -> AppResult<Vec<User>> {
    let pattern = format!(
        "{}%",
        prefix.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
    );
    Ok(sqlx::query_as::<_, User>(&format!(
        "SELECT {COLUMNS} FROM users WHERE username LIKE ? AND id <> ? ORDER BY username LIMIT 10"
    ))
    .bind(pattern)
    .bind(exclude)
    .fetch_all(&state.db.reader)
    .await?)
}

pub async fn note(state: &AppState, owner: Id, target: Id) -> AppResult<Option<String>> {
    let row: Option<(String,)> = sqlx::query_as("SELECT note FROM user_notes WHERE owner_id = ? AND target_id = ?")
        .bind(owner)
        .bind(target)
        .fetch_optional(&state.db.writer)
        .await?;
    Ok(row.map(|(n,)| n))
}

pub async fn set_presence(
    state: &AppState,
    id: Id,
    status: StatusSetting,
    custom: Option<&CustomStatus>,
) -> AppResult<()> {
    sqlx::query(
        "UPDATE users SET status = ?, custom_status_text = ?, custom_status_emoji = ?, custom_status_expires_at = ? WHERE id = ?",
    )
    .bind(status)
    .bind(custom.and_then(|c| c.text.as_deref()))
    .bind(custom.and_then(|c| c.emoji.as_deref()))
    .bind(custom.and_then(|c| c.expires_at))
    .bind(id)
    .execute(&state.db.writer)
    .await?;
    Ok(())
}

pub async fn set_note(state: &AppState, owner: Id, target: Id, note: &str) -> AppResult<()> {
    if note.is_empty() {
        sqlx::query("DELETE FROM user_notes WHERE owner_id = ? AND target_id = ?")
            .bind(owner)
            .bind(target)
            .execute(&state.db.writer)
            .await?;
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO user_notes (owner_id, target_id, note, updated_at) VALUES (?, ?, ?, ?) \
         ON DUPLICATE KEY UPDATE note = VALUES(note), updated_at = VALUES(updated_at)",
    )
    .bind(owner)
    .bind(target)
    .bind(note)
    .bind(chrono::Utc::now())
    .execute(&state.db.writer)
    .await?;
    Ok(())
}
