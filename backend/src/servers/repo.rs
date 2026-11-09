use chrono::Utc;
use sqlx::{MySql, Transaction};

use crate::cache::{self, DEFAULT_TTL};
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::permissions::bits;
use crate::state::AppState;

use super::models::Server;
use super::templates::ServerTemplate;

const SELECT: &str = "SELECT s.id, s.name, s.description, s.icon_url, s.owner_id, s.is_public, s.created_at, \
    (SELECT COUNT(*) FROM server_members m WHERE m.server_id = s.id) AS member_count FROM servers s";

pub async fn get(state: &AppState, id: Id) -> AppResult<Server> {
    cache::remember(state, &cache::server_key(id), DEFAULT_TTL, || async {
        sqlx::query_as::<_, Server>(&format!("{SELECT} WHERE s.id = ?"))
            .bind(id)
            .fetch_optional(&state.db.writer)
            .await?
            .ok_or(AppError::NotFound("server"))
    })
    .await
}

pub async fn forget(state: &AppState, id: Id) -> AppResult<()> {
    cache::del(state, &cache::server_key(id)).await
}

pub async fn list_for_user(state: &AppState, user: Id) -> AppResult<Vec<Server>> {
    Ok(sqlx::query_as::<_, Server>(&format!(
        "{SELECT} JOIN server_members me ON me.server_id = s.id AND me.user_id = ? ORDER BY me.joined_at"
    ))
    .bind(user)
    .fetch_all(&state.db.writer)
    .await?)
}

pub async fn ids_for_user(state: &AppState, user: Id) -> AppResult<Vec<Id>> {
    let rows: Vec<(Id,)> = sqlx::query_as("SELECT server_id FROM server_members WHERE user_id = ?")
        .bind(user)
        .fetch_all(&state.db.writer)
        .await?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}

pub async fn discover(state: &AppState, q: &str) -> AppResult<Vec<Server>> {
    let pattern = format!("%{}%", q.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_"));
    Ok(sqlx::query_as::<_, Server>(&format!(
        "{SELECT} WHERE s.is_public = 1 AND s.name LIKE ? ORDER BY member_count DESC, s.id LIMIT 50"
    ))
    .bind(pattern)
    .fetch_all(&state.db.reader)
    .await?)
}

pub struct NewServer<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub icon_url: Option<&'a str>,
    pub is_public: bool,
    pub owner: Id,
    pub template: ServerTemplate,
}

/// Creates the server with default roles and channels; the owner joins as Admin.
pub async fn create(state: &AppState, new: NewServer<'_>) -> AppResult<Id> {
    let id = state.ids.next();
    let now = Utc::now();
    let mut tx = state.db.writer.begin().await?;
    sqlx::query("INSERT INTO servers (id, name, description, icon_url, owner_id, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id)
        .bind(new.name)
        .bind(new.description)
        .bind(new.icon_url)
        .bind(new.owner)
        .bind(new.is_public)
        .bind(now)
        .execute(&mut *tx)
        .await?;

    let admin = state.ids.next();
    let roles = [
        (id, "@everyone", bits::DEFAULT_EVERYONE, 0, true),
        (state.ids.next(), "Member", 0, 1, false),
        (state.ids.next(), "Mod", bits::MODERATOR, 2, false),
        (admin, "Admin", bits::ADMINISTRATOR, 3, false),
    ];
    for (role_id, name, perms, position, is_default) in roles {
        sqlx::query(
            "INSERT INTO roles (id, server_id, name, permissions, position, is_default) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(role_id)
        .bind(id)
        .bind(name)
        .bind(perms)
        .bind(position)
        .bind(is_default)
        .execute(&mut *tx)
        .await?;
    }

    for (cat_position, (category, channels)) in new.template.layout().iter().enumerate() {
        let cat_id = state.ids.next();
        insert_channel(&mut tx, cat_id, id, "category", category, None, cat_position as i32).await?;
        for (position, (kind, name)) in channels.iter().enumerate() {
            insert_channel(&mut tx, state.ids.next(), id, kind, name, Some(cat_id), position as i32).await?;
        }
    }

    add_member_tx(&mut tx, id, new.owner).await?;
    sqlx::query("INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)")
        .bind(id)
        .bind(new.owner)
        .bind(admin)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(id)
}

async fn insert_channel(
    tx: &mut Transaction<'_, MySql>,
    id: Id,
    server: Id,
    kind: &str,
    name: &str,
    parent: Option<Id>,
    position: i32,
) -> AppResult<()> {
    sqlx::query("INSERT INTO channels (id, server_id, type, name, parent_id, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id)
        .bind(server)
        .bind(kind)
        .bind(name)
        .bind(parent)
        .bind(position)
        .bind(Utc::now())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn add_member_tx(tx: &mut Transaction<'_, MySql>, server: Id, user: Id) -> AppResult<()> {
    sqlx::query("INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)")
        .bind(server)
        .bind(user)
        .bind(Utc::now())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn update(
    state: &AppState,
    id: Id,
    name: &str,
    description: Option<&str>,
    is_public: bool,
    icon_url: Option<&str>,
) -> AppResult<()> {
    sqlx::query("UPDATE servers SET name = ?, description = ?, is_public = ?, icon_url = ? WHERE id = ?")
        .bind(name)
        .bind(description)
        .bind(is_public)
        .bind(icon_url)
        .bind(id)
        .execute(&state.db.writer)
        .await?;
    forget(state, id).await
}

pub async fn delete(state: &AppState, id: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM servers WHERE id = ?")
        .bind(id)
        .execute(&state.db.writer)
        .await?;
    forget(state, id).await
}

pub async fn is_banned(state: &AppState, server: Id, user: Id) -> AppResult<bool> {
    let row: Option<(Id,)> = sqlx::query_as("SELECT user_id FROM bans WHERE server_id = ? AND user_id = ?")
        .bind(server)
        .bind(user)
        .fetch_optional(&state.db.writer)
        .await?;
    Ok(row.is_some())
}

/// Servers both users belong to.
pub async fn mutual(state: &AppState, a: Id, b: Id) -> AppResult<Vec<Server>> {
    Ok(sqlx::query_as::<_, Server>(&format!(
        "{SELECT} JOIN server_members ma ON ma.server_id = s.id AND ma.user_id = ? \
         JOIN server_members mb ON mb.server_id = s.id AND mb.user_id = ? ORDER BY s.name"
    ))
    .bind(a)
    .bind(b)
    .fetch_all(&state.db.reader)
    .await?)
}
