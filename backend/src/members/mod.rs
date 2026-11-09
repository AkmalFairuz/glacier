pub mod handlers;
pub mod models;
pub mod repo;

use axum::routing::{get, patch, put};
use axum::Router;
use serde_json::json;

use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::permissions;
use crate::servers::{self, Server};
use crate::state::AppState;

pub use models::Member;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/servers/{id}/members", get(handlers::list))
        .route(
            "/servers/{id}/members/{uid}",
            patch(handlers::update).delete(handlers::remove),
        )
        .route("/servers/{id}/bans", get(handlers::bans))
        .route("/servers/{id}/bans/{uid}", put(handlers::ban).delete(handlers::unban))
}

/// Adds `user` to `server` (public join or invite) and announces it.
pub async fn join(state: &AppState, server: Id, user: Id) -> AppResult<Server> {
    if servers::repo::is_banned(state, server, user).await? {
        return Err(AppError::Forbidden("you are banned from this server"));
    }
    let inserted = repo::insert(state, server, user).await?;
    permissions::forget_member(state, server, user).await?;
    servers::repo::forget(state, server).await?;
    let info = servers::repo::get(state, server).await?;
    if inserted {
        let member = repo::get(state, server, user).await?;
        gateway::publish(state, Target::User(user), Event::new("SERVER_CREATE", &info)).await;
        gateway::publish(state, Target::Server(server), Event::new("MEMBER_ADD", &member)).await;
    }
    Ok(info)
}

pub async fn announce_update(state: &AppState, member: &Member) {
    gateway::publish(
        state,
        Target::Server(member.server_id),
        Event::new("MEMBER_UPDATE", member),
    )
    .await;
    gateway::publish(
        state,
        Target::User(member.user.id),
        Event::new("PERMISSIONS_CHANGED", json!({ "server_id": member.server_id })),
    )
    .await;
}

/// Called after a leave, kick or ban.
pub async fn announce_removal(state: &AppState, server: Id, user: Id) -> AppResult<()> {
    permissions::forget_member(state, server, user).await?;
    servers::repo::forget(state, server).await?;
    gateway::publish(
        state,
        Target::User(user),
        Event::new("SERVER_DELETE", json!({ "id": server })),
    )
    .await;
    gateway::publish(
        state,
        Target::Server(server),
        Event::new("MEMBER_REMOVE", json!({ "server_id": server, "user_id": user })),
    )
    .await;
    Ok(())
}
