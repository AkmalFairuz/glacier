//! Loading and caching of [`PermContext`] and member role lists.
//! The context is keyed by a per-server version that is bumped on every
//! change to roles, channels or overwrites, so stale entries just expire.
use std::collections::HashMap;

use redis::AsyncCommands;

use crate::cache::{self, DEFAULT_TTL};
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::state::AppState;

use super::resolve::{Overwrite, PermContext, RoleInfo, TargetType};

pub async fn bump(state: &AppState, server: Id) -> AppResult<()> {
    let _: i64 = state.redis().incr(cache::perm_version_key(server), 1).await?;
    Ok(())
}

pub async fn forget_member(state: &AppState, server: Id, user: Id) -> AppResult<()> {
    cache::del(state, &cache::member_roles_key(server, user)).await
}

pub async fn context(state: &AppState, server: Id) -> AppResult<PermContext> {
    let version: Option<u64> = state.redis().get(cache::perm_version_key(server)).await?;
    let key = cache::perm_ctx_key(server, version.unwrap_or(0));
    cache::remember(state, &key, DEFAULT_TTL, || load_context(state, server)).await
}

async fn load_context(state: &AppState, server: Id) -> AppResult<PermContext> {
    let db = &state.db.writer;
    let (owner_id,): (Id,) = sqlx::query_as("SELECT owner_id FROM servers WHERE id = ?")
        .bind(server)
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound("server"))?;
    let roles: Vec<(Id, u64, i32)> = sqlx::query_as("SELECT id, permissions, position FROM roles WHERE server_id = ?")
        .bind(server)
        .fetch_all(db)
        .await?;
    let channels: Vec<(Id,)> = sqlx::query_as("SELECT id FROM channels WHERE server_id = ?")
        .bind(server)
        .fetch_all(db)
        .await?;
    let rows: Vec<(Id, Id, TargetType, u64, u64)> = sqlx::query_as(
        "SELECT o.channel_id, o.target_id, o.target_type, o.allow_bits, o.deny_bits \
         FROM channel_overwrites o JOIN channels c ON c.id = o.channel_id WHERE c.server_id = ?",
    )
    .bind(server)
    .fetch_all(db)
    .await?;

    let mut overwrites: HashMap<Id, Vec<Overwrite>> = HashMap::new();
    for (channel, target_id, target_type, allow, deny) in rows {
        overwrites.entry(channel).or_default().push(Overwrite {
            target_id,
            target_type,
            allow,
            deny,
        });
    }
    Ok(PermContext {
        server_id: server,
        owner_id,
        roles: roles
            .into_iter()
            .map(|(id, permissions, position)| (id, RoleInfo { permissions, position }))
            .collect(),
        channels: channels.into_iter().map(|(id,)| id).collect(),
        overwrites,
    })
}

/// Role ids of a member, or `None` when the user is not in the server.
pub async fn member_roles(state: &AppState, server: Id, user: Id) -> AppResult<Option<Vec<Id>>> {
    let key = cache::member_roles_key(server, user);
    cache::remember(state, &key, DEFAULT_TTL, || async {
        let db = &state.db.writer;
        let member: Option<(Id,)> =
            sqlx::query_as("SELECT user_id FROM server_members WHERE server_id = ? AND user_id = ?")
                .bind(server)
                .bind(user)
                .fetch_optional(db)
                .await?;
        if member.is_none() {
            return Ok(None);
        }
        let roles: Vec<(Id,)> = sqlx::query_as("SELECT role_id FROM member_roles WHERE server_id = ? AND user_id = ?")
            .bind(server)
            .bind(user)
            .fetch_all(db)
            .await?;
        Ok(Some(roles.into_iter().map(|(id,)| id).collect()))
    })
    .await
}
