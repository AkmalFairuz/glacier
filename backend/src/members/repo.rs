use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::MySqlPool;

use crate::error::{AppError, AppResult};
use crate::gateway::presence;
use crate::id::Id;
use crate::state::AppState;
use crate::users;

use super::models::{Ban, Member};

async fn assemble(
    state: &AppState,
    server: Id,
    rows: Vec<(Id, Option<String>, DateTime<Utc>)>,
    pool: &MySqlPool,
) -> AppResult<Vec<Member>> {
    let ids: Vec<Id> = rows.iter().map(|r| r.0).collect();
    let mut by_id: HashMap<Id, users::User> = users::repo::get_many(state, &ids)
        .await?
        .into_iter()
        .map(|u| (u.id, u))
        .collect();
    let role_rows: Vec<(Id, Id)> = sqlx::query_as("SELECT user_id, role_id FROM member_roles WHERE server_id = ?")
        .bind(server)
        .fetch_all(pool)
        .await?;
    let mut roles: HashMap<Id, Vec<Id>> = HashMap::new();
    for (user, role) in role_rows {
        roles.entry(user).or_default().push(role);
    }
    let online = presence::online_many(state, &ids).await?;
    Ok(rows
        .into_iter()
        .zip(online)
        .filter_map(|((user_id, nickname, joined_at), online)| {
            Some(Member {
                server_id: server,
                user: by_id.remove(&user_id)?,
                nickname,
                role_ids: roles.remove(&user_id).unwrap_or_default(),
                joined_at,
                online,
            })
        })
        .collect())
}

pub async fn list(state: &AppState, server: Id) -> AppResult<Vec<Member>> {
    let rows = sqlx::query_as(
        "SELECT user_id, nickname, joined_at FROM server_members WHERE server_id = ? ORDER BY joined_at",
    )
    .bind(server)
    .fetch_all(&state.db.reader)
    .await?;
    assemble(state, server, rows, &state.db.reader).await
}

pub async fn get(state: &AppState, server: Id, user: Id) -> AppResult<Member> {
    let rows =
        sqlx::query_as("SELECT user_id, nickname, joined_at FROM server_members WHERE server_id = ? AND user_id = ?")
            .bind(server)
            .bind(user)
            .fetch_all(&state.db.writer)
            .await?;
    assemble(state, server, rows, &state.db.writer)
        .await?
        .pop()
        .ok_or(AppError::NotFound("member"))
}

/// Inserts the membership; returns false if the user was already a member.
pub async fn insert(state: &AppState, server: Id, user: Id) -> AppResult<bool> {
    let res = sqlx::query("INSERT IGNORE INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)")
        .bind(server)
        .bind(user)
        .bind(Utc::now())
        .execute(&state.db.writer)
        .await?;
    Ok(res.rows_affected() == 1)
}

pub async fn remove(state: &AppState, server: Id, user: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM server_members WHERE server_id = ? AND user_id = ?")
        .bind(server)
        .bind(user)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}

pub async fn set_nickname(state: &AppState, server: Id, user: Id, nickname: Option<&str>) -> AppResult<()> {
    sqlx::query("UPDATE server_members SET nickname = ? WHERE server_id = ? AND user_id = ?")
        .bind(nickname)
        .bind(server)
        .bind(user)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}

pub async fn set_roles(state: &AppState, server: Id, user: Id, roles: &[Id]) -> AppResult<()> {
    let mut tx = state.db.writer.begin().await?;
    sqlx::query("DELETE FROM member_roles WHERE server_id = ? AND user_id = ?")
        .bind(server)
        .bind(user)
        .execute(&mut *tx)
        .await?;
    for role in roles {
        sqlx::query("INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)")
            .bind(server)
            .bind(user)
            .bind(role)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn ban(state: &AppState, server: Id, user: Id, reason: Option<&str>) -> AppResult<()> {
    sqlx::query("REPLACE INTO bans (server_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)")
        .bind(server)
        .bind(user)
        .bind(reason)
        .bind(Utc::now())
        .execute(&state.db.writer)
        .await?;
    remove(state, server, user).await
}

pub async fn unban(state: &AppState, server: Id, user: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM bans WHERE server_id = ? AND user_id = ?")
        .bind(server)
        .bind(user)
        .execute(&state.db.writer)
        .await?;
    Ok(())
}

/// Primary, so a just-applied ban is always listed.
pub async fn bans(state: &AppState, server: Id) -> AppResult<Vec<Ban>> {
    let rows: Vec<(Id, Option<String>, DateTime<Utc>)> =
        sqlx::query_as("SELECT user_id, reason, created_at FROM bans WHERE server_id = ? ORDER BY created_at DESC")
            .bind(server)
            .fetch_all(&state.db.writer)
            .await?;
    let ids: Vec<Id> = rows.iter().map(|r| r.0).collect();
    let mut users: HashMap<Id, users::User> = users::repo::get_many(state, &ids)
        .await?
        .into_iter()
        .map(|u| (u.id, u))
        .collect();
    Ok(rows
        .into_iter()
        .filter_map(|(id, reason, created_at)| {
            Some(Ban {
                user: users.remove(&id)?,
                reason,
                created_at,
            })
        })
        .collect())
}
