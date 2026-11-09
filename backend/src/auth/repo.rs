use chrono::Utc;

use crate::error::AppResult;
use crate::id::Id;
use crate::state::AppState;

use super::models::Credentials;

pub async fn insert_user(state: &AppState, id: Id, username: &str, display_name: &str, hash: &str) -> AppResult<()> {
    sqlx::query("INSERT INTO users (id, username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id)
        .bind(username)
        .bind(display_name)
        .bind(hash)
        .bind(Utc::now())
        .execute(&state.db.writer)
        .await?;
    Ok(())
}

pub async fn credentials(state: &AppState, username: &str) -> AppResult<Option<Credentials>> {
    Ok(
        sqlx::query_as::<_, Credentials>("SELECT id, password_hash FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(&state.db.writer)
            .await?,
    )
}

pub async fn password_hash(state: &AppState, user: Id) -> AppResult<String> {
    let (hash,): (String,) = sqlx::query_as("SELECT password_hash FROM users WHERE id = ?")
        .bind(user)
        .fetch_one(&state.db.writer)
        .await?;
    Ok(hash)
}

pub async fn set_password_hash(state: &AppState, user: Id, hash: &str) -> AppResult<()> {
    sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(hash)
        .bind(user)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}
