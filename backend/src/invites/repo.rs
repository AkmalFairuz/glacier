use chrono::{DateTime, Utc};
use rand::distributions::Alphanumeric;
use rand::Rng;

use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::state::AppState;

use super::models::InviteRow;

const COLUMNS: &str = "code, server_id, inviter_id, max_uses, uses, expires_at, created_at";

pub async fn create(
    state: &AppState,
    server: Id,
    inviter: Id,
    max_uses: Option<u32>,
    expires_at: Option<DateTime<Utc>>,
) -> AppResult<String> {
    // Lowercase only: the column compares case-insensitively.
    let code: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .map(|b| char::from(b).to_ascii_lowercase())
        .take(10)
        .collect();
    sqlx::query(
        "INSERT INTO invites (code, server_id, inviter_id, max_uses, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&code)
    .bind(server)
    .bind(inviter)
    .bind(max_uses)
    .bind(expires_at)
    .bind(Utc::now())
    .execute(&state.db.writer)
    .await?;
    Ok(code)
}

pub async fn get(state: &AppState, code: &str) -> AppResult<InviteRow> {
    sqlx::query_as::<_, InviteRow>(&format!("SELECT {COLUMNS} FROM invites WHERE code = ?"))
        .bind(code)
        .fetch_optional(&state.db.writer)
        .await?
        .ok_or(AppError::NotFound("invite"))
}

/// Primary, so a just-created invite is always listed.
pub async fn list(state: &AppState, server: Id) -> AppResult<Vec<InviteRow>> {
    Ok(sqlx::query_as::<_, InviteRow>(&format!(
        "SELECT {COLUMNS} FROM invites WHERE server_id = ? ORDER BY created_at DESC"
    ))
    .bind(server)
    .fetch_all(&state.db.writer)
    .await?)
}

/// Atomically consumes one use; false when the invite is exhausted or expired.
pub async fn consume(state: &AppState, code: &str) -> AppResult<bool> {
    let res = sqlx::query(
        "UPDATE invites SET uses = uses + 1 WHERE code = ? \
         AND (max_uses IS NULL OR uses < max_uses) AND (expires_at IS NULL OR expires_at > ?)",
    )
    .bind(code)
    .bind(Utc::now())
    .execute(&state.db.writer)
    .await?;
    Ok(res.rows_affected() == 1)
}

pub async fn delete(state: &AppState, code: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM invites WHERE code = ?")
        .bind(code)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}
