use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::json;

use crate::auth::AuthUser;
use crate::channels;
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event};
use crate::id::Id;
use crate::permissions::bits;
use crate::state::AppState;
use crate::{ratelimit, users};

use super::models::{CreateMessage, EditMessage, ListQuery, Message};
use super::repo;

const MAX_LEN: usize = 4000;

fn clean_content(content: &str) -> AppResult<String> {
    let content = content.trim();
    if content.chars().count() > MAX_LEN {
        return Err(AppError::bad("message must be at most 4000 characters"));
    }
    Ok(content.to_string())
}

#[utoipa::path(get, path = "/api/channels/{id}/messages", tag = "messages",
    params(("id" = Id, Path), ListQuery), responses((status = 200, body = Vec<Message>, description = "oldest to newest")))]
pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<Message>>> {
    let access = channels::access(&state, id, auth.id).await?;
    access.require_text()?;
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    Ok(Json(repo::list(&state, id, q.before, limit).await?))
}

#[utoipa::path(post, path = "/api/channels/{id}/messages", tag = "messages",
    params(("id" = Id, Path)), request_body = CreateMessage, responses((status = 201, body = Message)))]
pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Json(body): Json<CreateMessage>,
) -> AppResult<(StatusCode, Json<Message>)> {
    let access = channels::access(&state, id, auth.id).await?;
    access.require_text()?;
    access.require(bits::SEND_MESSAGES)?;
    if !body.attachment_ids.is_empty() {
        access.require(bits::ATTACH_FILES)?;
    }
    if body.attachment_ids.len() > 10 {
        return Err(AppError::bad("at most 10 attachments per message"));
    }
    let content = clean_content(&body.content)?;
    if content.is_empty() && body.attachment_ids.is_empty() {
        return Err(AppError::bad("message cannot be empty"));
    }
    if let Some(original) = body.reply_to {
        // Must exist in this channel; read from the primary so a just-sent message can be replied to.
        repo::author_of(&state, id, original)
            .await
            .map_err(|_| AppError::bad("the message you are replying to no longer exists"))?;
    }
    ratelimit::check(&state, "message", &auth.id.to_string(), 10, 5).await?;
    let slowmode = access.channel.rate_limit_per_user;
    if slowmode > 0 && !access.has(bits::MANAGE_MESSAGES) && !access.has(bits::MANAGE_CHANNELS) {
        ratelimit::slowmode(&state, id, auth.id, slowmode).await?;
    }
    let message_id = repo::insert(
        &state,
        repo::NewMessage {
            channel: id,
            author: auth.id,
            content: &content,
            attachments: &body.attachment_ids,
            reply_to: body.reply_to,
        },
    )
    .await?;
    let message = repo::get(&state, id, message_id).await?;
    gateway::publish(&state, access.target(), Event::new("MESSAGE_CREATE", &message)).await;
    crate::embeds::refresh(state.clone(), access.target(), id, message_id, content.clone());
    crate::reads::mark_read(&state, auth.id, id, access.channel.server_id, message_id).await?;
    Ok((StatusCode::CREATED, Json(message)))
}

#[utoipa::path(patch, path = "/api/channels/{cid}/messages/{mid}", tag = "messages",
    params(("cid" = Id, Path), ("mid" = Id, Path)), request_body = EditMessage, responses((status = 200, body = Message)))]
pub async fn edit(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((cid, mid)): Path<(Id, Id)>,
    Json(body): Json<EditMessage>,
) -> AppResult<Json<Message>> {
    let access = channels::access(&state, cid, auth.id).await?;
    if repo::author_of(&state, cid, mid).await? != auth.id {
        return Err(AppError::Forbidden("you can only edit your own messages"));
    }
    let content = clean_content(&body.content)?;
    if content.is_empty() {
        return Err(AppError::bad("message cannot be empty"));
    }
    repo::edit(&state, mid, &content).await?;
    let message = repo::get(&state, cid, mid).await?;
    gateway::publish(&state, access.target(), Event::new("MESSAGE_UPDATE", &message)).await;
    crate::embeds::refresh(state.clone(), access.target(), cid, mid, content);
    Ok(Json(message))
}

#[utoipa::path(delete, path = "/api/channels/{cid}/messages/{mid}", tag = "messages",
    params(("cid" = Id, Path), ("mid" = Id, Path)), responses((status = 204)))]
pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((cid, mid)): Path<(Id, Id)>,
) -> AppResult<StatusCode> {
    let access = channels::access(&state, cid, auth.id).await?;
    if repo::author_of(&state, cid, mid).await? != auth.id && !access.has(bits::MANAGE_MESSAGES) {
        return Err(AppError::Forbidden("missing permission"));
    }
    repo::delete(&state, mid).await?;
    gateway::publish(
        &state,
        access.target(),
        Event::new("MESSAGE_DELETE", json!({ "id": mid, "channel_id": cid })),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(post, path = "/api/channels/{id}/typing", tag = "messages", params(("id" = Id, Path)), responses((status = 204)))]
pub async fn typing(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<StatusCode> {
    let access = channels::access(&state, id, auth.id).await?;
    access.require(bits::SEND_MESSAGES)?;
    let user = users::repo::get(&state, auth.id).await?;
    let event = Event::new(
        "TYPING_START",
        json!({ "channel_id": id, "user_id": auth.id, "display_name": user.display_name }),
    );
    gateway::publish(&state, access.target(), event).await;
    Ok(StatusCode::NO_CONTENT)
}
