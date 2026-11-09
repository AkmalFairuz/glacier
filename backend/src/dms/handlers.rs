use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::json;

use crate::auth::AuthUser;
use crate::channels::{Channel, ChannelType};
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::state::AppState;
use crate::users;

use super::models::{CreateDm, RenameDm};
use super::repo;

const MAX_GROUP: usize = 10;

fn clean_name(name: &str) -> AppResult<Option<String>> {
    let name = name.trim();
    if name.chars().count() > 100 {
        return Err(AppError::bad("name must be at most 100 characters"));
    }
    Ok(Some(name.to_string()).filter(|n| !n.is_empty()))
}

async fn group_for(state: &AppState, channel: Id, user: Id) -> AppResult<Channel> {
    let dm = repo::get(state, channel).await?;
    if !dm.recipients.iter().any(|u| u.id == user) {
        return Err(AppError::NotFound("channel"));
    }
    if dm.kind != ChannelType::GroupDm {
        return Err(AppError::bad("only group DMs can be changed"));
    }
    Ok(dm)
}

#[utoipa::path(get, path = "/api/dms", tag = "dms", responses((status = 200, body = Vec<Channel>)))]
pub async fn list(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<Vec<Channel>>> {
    Ok(Json(repo::list(&state, auth.id).await?))
}

#[utoipa::path(post, path = "/api/dms", tag = "dms", request_body = CreateDm, responses((status = 200, body = Channel)))]
pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateDm>,
) -> AppResult<Json<Channel>> {
    let mut others = body.user_ids;
    others.sort();
    others.dedup();
    others.retain(|u| *u != auth.id);
    if others.is_empty() {
        return Err(AppError::bad("pick at least one other user"));
    }
    if others.len() + 1 > MAX_GROUP {
        return Err(AppError::bad("group DMs are limited to 10 people"));
    }
    if users::repo::get_many(&state, &others).await?.len() != others.len() {
        return Err(AppError::NotFound("user"));
    }
    if others.len() == 1 {
        if let Some(existing) = repo::find_direct(&state, auth.id, others[0]).await? {
            return Ok(Json(repo::get(&state, existing).await?));
        }
    }
    let mut everyone = others.clone();
    everyone.push(auth.id);
    let id = if others.len() == 1 {
        repo::create(&state, ChannelType::Dm, None, None, &everyone).await?
    } else {
        let name = clean_name(body.name.as_deref().unwrap_or(""))?;
        repo::create(&state, ChannelType::GroupDm, Some(auth.id), name.as_deref(), &everyone).await?
    };
    let channel = repo::get(&state, id).await?;
    gateway::publish(&state, Target::Users(everyone), Event::new("CHANNEL_CREATE", &channel)).await;
    Ok(Json(channel))
}

#[utoipa::path(patch, path = "/api/dms/{id}", tag = "dms", params(("id" = Id, Path)), request_body = RenameDm, responses((status = 200, body = Channel)))]
pub async fn rename(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Json(body): Json<RenameDm>,
) -> AppResult<Json<Channel>> {
    group_for(&state, id, auth.id).await?;
    let name = clean_name(&body.name)?.ok_or(AppError::bad("name cannot be empty"))?;
    repo::rename(&state, id, &name).await?;
    let channel = repo::get(&state, id).await?;
    gateway::publish(
        &state,
        Target::Channel {
            server: None,
            channel: id,
        },
        Event::new("CHANNEL_UPDATE", &channel),
    )
    .await;
    Ok(Json(channel))
}

#[utoipa::path(put, path = "/api/dms/{id}/recipients/{uid}", tag = "dms", params(("id" = Id, Path), ("uid" = Id, Path)), responses((status = 200, body = Channel)))]
pub async fn add_recipient(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, uid)): Path<(Id, Id)>,
) -> AppResult<Json<Channel>> {
    let dm = group_for(&state, id, auth.id).await?;
    if dm.recipients.len() >= MAX_GROUP {
        return Err(AppError::bad("group DMs are limited to 10 people"));
    }
    users::repo::get(&state, uid).await?;
    repo::add_participant(&state, id, uid).await?;
    let channel = repo::get(&state, id).await?;
    gateway::publish(&state, Target::User(uid), Event::new("CHANNEL_CREATE", &channel)).await;
    let others: Vec<Id> = channel.recipients.iter().map(|u| u.id).filter(|u| *u != uid).collect();
    gateway::publish(&state, Target::Users(others), Event::new("CHANNEL_UPDATE", &channel)).await;
    Ok(Json(channel))
}

#[utoipa::path(delete, path = "/api/dms/{id}/recipients/@me", tag = "dms", params(("id" = Id, Path)), responses((status = 204)))]
pub async fn leave(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<StatusCode> {
    group_for(&state, id, auth.id).await?;
    let remaining = repo::remove_participant(&state, id, auth.id).await?;
    gateway::publish(
        &state,
        Target::User(auth.id),
        Event::new("CHANNEL_DELETE", json!({ "id": id, "server_id": null })),
    )
    .await;
    if !remaining.is_empty() {
        let channel = repo::get(&state, id).await?;
        gateway::publish(&state, Target::Users(remaining), Event::new("CHANNEL_UPDATE", &channel)).await;
    }
    Ok(StatusCode::NO_CONTENT)
}
