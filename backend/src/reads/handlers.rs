use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::json;

use crate::auth::AuthUser;
use crate::channels;
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::state::AppState;

use super::models::{AckBody, ReadReceipt};
use super::repo;

#[utoipa::path(put, path = "/api/channels/{id}/ack", tag = "messages", params(("id" = Id, Path)), request_body = AckBody, responses((status = 204)))]
pub async fn ack(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Json(body): Json<AckBody>,
) -> AppResult<StatusCode> {
    let access = channels::access(&state, id, auth.id).await?;
    access.require_text()?;
    mark_read(&state, auth.id, id, access.channel.server_id, body.message_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Stores the read position and tells the user's other sessions (and, in DMs, the other participants).
pub async fn mark_read(state: &AppState, user: Id, channel: Id, server: Option<Id>, message: Id) -> AppResult<()> {
    let stored = repo::ack(state, user, channel, message).await?;
    let d = json!({ "channel_id": channel, "last_read_message_id": stored });
    gateway::publish(state, Target::User(user), Event::new("READ_STATE_UPDATE", d)).await;
    if server.is_none() {
        let d = json!({ "channel_id": channel, "user_id": user, "last_read_message_id": stored });
        gateway::publish(
            state,
            Target::Channel { server: None, channel },
            Event::new("RECEIPT_UPDATE", d),
        )
        .await;
    }
    Ok(())
}

#[utoipa::path(get, path = "/api/channels/{id}/receipts", tag = "messages", params(("id" = Id, Path)), responses((status = 200, body = Vec<ReadReceipt>)))]
pub async fn receipts(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
) -> AppResult<Json<Vec<ReadReceipt>>> {
    let access = channels::access(&state, id, auth.id).await?;
    if access.channel.server_id.is_some() {
        return Err(AppError::bad("read receipts are only shown in direct messages"));
    }
    Ok(Json(repo::receipts(&state, id, auth.id).await?))
}
