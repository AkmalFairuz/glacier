pub mod bits;
mod cache;
mod resolve;

use std::collections::HashMap;

use serde::Serialize;
use utoipa::ToSchema;

use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::state::AppState;

pub use cache::{bump, context, forget_member};
pub use resolve::{Overwrite, PermContext, TargetType};

/// A server member with their permission context loaded.
pub struct Member {
    pub user: Id,
    pub role_ids: Vec<Id>,
    pub ctx: PermContext,
}

impl Member {
    pub fn base(&self) -> u64 {
        self.ctx.base(self.user, &self.role_ids)
    }

    pub fn channel(&self, channel: Id) -> u64 {
        self.ctx.channel(self.user, &self.role_ids, channel)
    }

    pub fn require(&self, bit: u64) -> AppResult<()> {
        if self.base() & bit == bit {
            Ok(())
        } else {
            Err(AppError::Forbidden("missing permission"))
        }
    }

    pub fn top_position(&self) -> i32 {
        self.ctx.top_position(self.user, &self.role_ids)
    }

    pub fn is_owner(&self) -> bool {
        self.user == self.ctx.owner_id
    }
}

/// Loads the caller as a member of `server`; 404 when they are not one.
pub async fn member(state: &AppState, server: Id, user: Id) -> AppResult<Member> {
    let role_ids = cache::member_roles(state, server, user)
        .await?
        .ok_or(AppError::NotFound("server"))?;
    let ctx = cache::context(state, server).await?;
    Ok(Member { user, role_ids, ctx })
}

pub async fn is_member(state: &AppState, server: Id, user: Id) -> AppResult<bool> {
    Ok(cache::member_roles(state, server, user).await?.is_some())
}

/// Effective permissions of the caller (schema name `Permissions`).
#[derive(Serialize, ToSchema)]
#[schema(as = Permissions)]
pub struct Effective {
    pub server: u64,
    /// channel id -> permission bits
    pub channels: HashMap<Id, u64>,
}

pub fn effective(m: &Member) -> Effective {
    Effective {
        server: m.base(),
        channels: m.ctx.channels.iter().map(|c| (*c, m.channel(*c))).collect(),
    }
}

/// Users of `server` who can view `channel`; `None` means "every member".
/// Uses the primary so a role change applies to the very next event.
pub async fn channel_audience(state: &AppState, server: Id, channel: Id) -> AppResult<Option<Vec<Id>>> {
    let ctx = cache::context(state, server).await?;
    if ctx.publicly_visible(channel) {
        return Ok(None);
    }
    let members: Vec<(Id,)> = sqlx::query_as("SELECT user_id FROM server_members WHERE server_id = ?")
        .bind(server)
        .fetch_all(&state.db.writer)
        .await?;
    let roles: Vec<(Id, Id)> = sqlx::query_as("SELECT user_id, role_id FROM member_roles WHERE server_id = ?")
        .bind(server)
        .fetch_all(&state.db.writer)
        .await?;
    let mut by_user: HashMap<Id, Vec<Id>> = HashMap::new();
    for (user, role) in roles {
        by_user.entry(user).or_default().push(role);
    }
    let visible = members
        .into_iter()
        .map(|(u,)| u)
        .filter(|u| {
            ctx.channel(*u, by_user.get(u).map(Vec::as_slice).unwrap_or_default(), channel) & bits::VIEW_CHANNEL != 0
        })
        .collect();
    Ok(Some(visible))
}
