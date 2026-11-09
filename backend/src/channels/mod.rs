pub mod handlers;
pub mod models;
pub mod repo;

use axum::routing::{get, patch, put};
use axum::Router;

use crate::dms;
use crate::error::{AppError, AppResult};
use crate::gateway::Target;
use crate::id::Id;
use crate::permissions::{self, bits};
use crate::state::AppState;

pub use models::{Channel, ChannelRow, ChannelType};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/servers/{id}/channels",
            get(handlers::list).post(handlers::create).patch(handlers::reorder),
        )
        .route("/channels/{id}", patch(handlers::update).delete(handlers::delete))
        .route(
            "/channels/{id}/overwrites/{target_id}",
            put(handlers::put_overwrite).delete(handlers::delete_overwrite),
        )
}

/// A channel together with the caller's effective permissions in it.
pub struct Access {
    pub channel: ChannelRow,
    pub perms: u64,
}

impl Access {
    pub fn require(&self, bit: u64) -> AppResult<()> {
        if self.perms & bit == bit {
            Ok(())
        } else {
            Err(AppError::Forbidden("missing permission"))
        }
    }

    pub fn has(&self, bit: u64) -> bool {
        self.perms & bit == bit
    }

    pub fn require_text(&self) -> AppResult<()> {
        match self.channel.kind {
            ChannelType::Text | ChannelType::Dm | ChannelType::GroupDm => Ok(()),
            _ => Err(AppError::bad("not a text channel")),
        }
    }

    pub fn target(&self) -> Target {
        Target::Channel {
            server: self.channel.server_id,
            channel: self.channel.id,
        }
    }
}

/// Resolves a server channel or DM the caller can view; 404 otherwise.
pub async fn access(state: &AppState, channel: Id, user: Id) -> AppResult<Access> {
    let row = repo::get(state, channel).await?;
    let perms = match row.server_id {
        Some(server) => match permissions::member(state, server, user).await {
            Ok(member) => member.channel(channel),
            Err(_) => 0,
        },
        None if dms::repo::is_participant(state, channel, user).await? => bits::DM,
        None => 0,
    };
    if perms & bits::VIEW_CHANNEL == 0 {
        return Err(AppError::NotFound("channel"));
    }
    Ok(Access { channel: row, perms })
}
