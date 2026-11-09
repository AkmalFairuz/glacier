use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::state::AppState;

use super::models::Role;

const COLUMNS: &str = "id, server_id, name, color, permissions, position, is_default";

pub async fn list(state: &AppState, server: Id) -> AppResult<Vec<Role>> {
    Ok(sqlx::query_as::<_, Role>(&format!(
        "SELECT {COLUMNS} FROM roles WHERE server_id = ? ORDER BY is_default ASC, position DESC"
    ))
    .bind(server)
    .fetch_all(&state.db.writer)
    .await?)
}

pub async fn get(state: &AppState, server: Id, id: Id) -> AppResult<Role> {
    sqlx::query_as::<_, Role>(&format!("SELECT {COLUMNS} FROM roles WHERE server_id = ? AND id = ?"))
        .bind(server)
        .bind(id)
        .fetch_optional(&state.db.writer)
        .await?
        .ok_or(AppError::NotFound("role"))
}

/// New roles go to position 1, directly above @everyone.
pub async fn create(state: &AppState, server: Id, name: &str, color: Option<u32>, perms: u64) -> AppResult<Id> {
    let id = state.ids.next();
    let mut tx = state.db.writer.begin().await?;
    sqlx::query("UPDATE roles SET position = position + 1 WHERE server_id = ? AND is_default = 0")
        .bind(server)
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO roles (id, server_id, name, color, permissions, position, is_default) VALUES (?, ?, ?, ?, ?, 1, 0)")
        .bind(id)
        .bind(server)
        .bind(name)
        .bind(color)
        .bind(perms)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(id)
}

pub async fn update(state: &AppState, role: &Role) -> AppResult<()> {
    sqlx::query("UPDATE roles SET name = ?, color = ?, permissions = ? WHERE id = ?")
        .bind(&role.name)
        .bind(role.color)
        .bind(role.permissions)
        .bind(role.id)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}

/// Moves `role` to `position` (1-based among non-default roles) and renumbers the rest.
pub async fn reorder(state: &AppState, server: Id, role: Id, position: i32) -> AppResult<Vec<Id>> {
    let mut ids: Vec<Id> = list(state, server)
        .await?
        .into_iter()
        .filter(|r| !r.is_default)
        .rev()
        .map(|r| r.id)
        .collect();
    ids.retain(|id| *id != role);
    let index = (position.max(1) as usize - 1).min(ids.len());
    ids.insert(index, role);
    let mut tx = state.db.writer.begin().await?;
    for (i, id) in ids.iter().enumerate() {
        sqlx::query("UPDATE roles SET position = ? WHERE id = ?")
            .bind(i as i32 + 1)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(ids)
}

pub async fn delete(state: &AppState, id: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM roles WHERE id = ?")
        .bind(id)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}
