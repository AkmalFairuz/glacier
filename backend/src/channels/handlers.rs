use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::json;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::permissions::{self, bits, PermContext, TargetType};
use crate::state::AppState;

use super::models::{Channel, ChannelPosition, ChannelRow, ChannelType, CreateChannel, PutOverwrite, UpdateChannel};
use super::repo;

fn server_channel(ctx: &PermContext, row: ChannelRow) -> Channel {
    let overwrites = ctx.overwrites.get(&row.id).cloned().unwrap_or_default();
    Channel::from_row(row, overwrites, vec![])
}

fn clean_name(name: &str, kind: ChannelType) -> AppResult<String> {
    let name = name.trim();
    let name = if kind == ChannelType::Text {
        name.to_lowercase().replace(' ', "-")
    } else {
        name.to_string()
    };
    if name.is_empty() || name.chars().count() > 100 {
        return Err(AppError::bad("channel name must be 1-100 characters"));
    }
    Ok(name)
}

/// Loads a server channel the caller may manage.
async fn managed(state: &AppState, channel: Id, user: Id, bit: u64) -> AppResult<(ChannelRow, permissions::Member)> {
    let row = repo::get(state, channel).await?;
    let server = row.server_id.ok_or(AppError::bad("not a server channel"))?;
    let member = permissions::member(state, server, user).await?;
    if member.channel(channel) & (bits::VIEW_CHANNEL | bit) != bits::VIEW_CHANNEL | bit {
        return Err(AppError::Forbidden("missing permission"));
    }
    Ok((row, member))
}

/// Re-reads the channel after a change, bumps permissions and broadcasts it.
async fn broadcast(state: &AppState, server: Id, channel: Id, event: &str) -> AppResult<Channel> {
    permissions::bump(state, server).await?;
    let ctx = permissions::context(state, server).await?;
    let row = repo::get(state, channel).await?;
    let channel_json = server_channel(&ctx, row);
    gateway::publish(
        state,
        Target::Channel {
            server: Some(server),
            channel,
        },
        Event::new(event, &channel_json),
    )
    .await;
    Ok(channel_json)
}

#[utoipa::path(get, path = "/api/servers/{id}/channels", tag = "channels", params(("id" = Id, Path)), responses((status = 200, body = Vec<Channel>)))]
pub async fn list(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<Json<Vec<Channel>>> {
    let member = permissions::member(&state, id, auth.id).await?;
    let rows = repo::list_for_server(&state, id).await?;
    Ok(Json(
        rows.into_iter()
            .filter(|r| member.channel(r.id) & bits::VIEW_CHANNEL != 0)
            .map(|r| server_channel(&member.ctx, r))
            .collect(),
    ))
}

#[utoipa::path(post, path = "/api/servers/{id}/channels", tag = "channels", params(("id" = Id, Path)), request_body = CreateChannel, responses((status = 200, body = Channel)))]
pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Json(body): Json<CreateChannel>,
) -> AppResult<Json<Channel>> {
    permissions::member(&state, id, auth.id)
        .await?
        .require(bits::MANAGE_CHANNELS)?;
    if body.kind.is_dm() {
        return Err(AppError::bad("use /api/dms for direct messages"));
    }
    let parent = match (body.parent_id, body.kind) {
        (Some(_), ChannelType::Category) => return Err(AppError::bad("categories cannot be nested")),
        (Some(p), _) => {
            let parent = repo::get(&state, p).await?;
            if parent.server_id != Some(id) || parent.kind != ChannelType::Category {
                return Err(AppError::bad("parent must be a category in this server"));
            }
            Some(p)
        }
        (None, _) => None,
    };
    let name = clean_name(&body.name, body.kind)?;
    let topic = body.topic.as_deref().map(str::trim).filter(|t| !t.is_empty());
    let channel = repo::create(&state, id, body.kind, &name, parent, topic).await?;
    Ok(Json(broadcast(&state, id, channel, "CHANNEL_CREATE").await?))
}

#[utoipa::path(patch, path = "/api/channels/{id}", tag = "channels", params(("id" = Id, Path)), request_body = UpdateChannel, responses((status = 200, body = Channel)))]
pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Json(body): Json<UpdateChannel>,
) -> AppResult<Json<Channel>> {
    let (mut row, _) = managed(&state, id, auth.id, bits::MANAGE_CHANNELS).await?;
    let server = row.server_id.ok_or(AppError::bad("not a server channel"))?;
    if let Some(name) = body.name {
        row.name = Some(clean_name(&name, row.kind)?);
    }
    if let Some(topic) = body.topic {
        row.topic = topic.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
    }
    if let Some(parent) = body.parent_id {
        if let Some(p) = parent {
            let p_row = repo::get(&state, p).await?;
            if row.kind == ChannelType::Category
                || p_row.server_id != Some(server)
                || p_row.kind != ChannelType::Category
            {
                return Err(AppError::bad("parent must be a category in this server"));
            }
        }
        row.parent_id = parent;
    }
    if let Some(position) = body.position {
        row.position = position.max(0);
    }
    if let Some(limit) = body.user_limit {
        if row.kind != ChannelType::Voice {
            return Err(AppError::bad("only voice channels have a user limit"));
        }
        if limit.is_some_and(|n| !(1..=100).contains(&n)) {
            return Err(AppError::bad("user limit must be between 1 and 100"));
        }
        row.user_limit = limit;
    }
    repo::update(&state, &row).await?;
    Ok(Json(broadcast(&state, server, id, "CHANNEL_UPDATE").await?))
}

#[utoipa::path(delete, path = "/api/channels/{id}", tag = "channels", params(("id" = Id, Path)), responses((status = 204)))]
pub async fn delete(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<StatusCode> {
    let (row, _) = managed(&state, id, auth.id, bits::MANAGE_CHANNELS).await?;
    let server = row.server_id.ok_or(AppError::bad("not a server channel"))?;
    let children: Vec<Id> = repo::list_for_server(&state, server)
        .await?
        .into_iter()
        .filter(|c| c.parent_id == Some(id))
        .map(|c| c.id)
        .collect();
    let event = Event::new("CHANNEL_DELETE", json!({ "id": id, "server_id": server }));
    gateway::publish(
        &state,
        Target::Channel {
            server: Some(server),
            channel: id,
        },
        event,
    )
    .await;
    repo::delete(&state, id).await?;
    for child in children {
        repo::forget(&state, child).await?;
        broadcast(&state, server, child, "CHANNEL_UPDATE").await?;
    }
    permissions::bump(&state, server).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(put, path = "/api/channels/{id}/overwrites/{target_id}", tag = "channels",
    params(("id" = Id, Path), ("target_id" = Id, Path)), request_body = PutOverwrite, responses((status = 200, body = Channel)))]
pub async fn put_overwrite(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, target)): Path<(Id, Id)>,
    Json(body): Json<PutOverwrite>,
) -> AppResult<Json<Channel>> {
    let (row, member) = managed(&state, id, auth.id, bits::MANAGE_ROLES).await?;
    let server = row.server_id.ok_or(AppError::bad("not a server channel"))?;
    if (body.allow | body.deny) & !bits::ALL != 0 || body.allow & body.deny != 0 {
        return Err(AppError::bad("invalid allow/deny bits"));
    }
    let valid_target = match body.target_type {
        TargetType::Role => member.ctx.roles.contains_key(&target),
        TargetType::Member => permissions::is_member(&state, server, target).await?,
    };
    if !valid_target {
        return Err(AppError::bad("unknown overwrite target"));
    }
    repo::put_overwrite(&state, id, target, body.target_type, body.allow, body.deny).await?;
    finish_overwrite_change(&state, server, id).await
}

#[utoipa::path(delete, path = "/api/channels/{id}/overwrites/{target_id}", tag = "channels",
    params(("id" = Id, Path), ("target_id" = Id, Path)), responses((status = 200, body = Channel)))]
pub async fn delete_overwrite(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, target)): Path<(Id, Id)>,
) -> AppResult<Json<Channel>> {
    let (row, _) = managed(&state, id, auth.id, bits::MANAGE_ROLES).await?;
    let server = row.server_id.ok_or(AppError::bad("not a server channel"))?;
    repo::delete_overwrite(&state, id, target).await?;
    finish_overwrite_change(&state, server, id).await
}

async fn finish_overwrite_change(state: &AppState, server: Id, channel: Id) -> AppResult<Json<Channel>> {
    let updated = broadcast(state, server, channel, "CHANNEL_UPDATE").await?;
    // Members who lost or gained access refetch their channel list.
    gateway::publish(
        state,
        Target::Server(server),
        Event::new("PERMISSIONS_CHANGED", json!({ "server_id": server })),
    )
    .await;
    Ok(Json(updated))
}

#[utoipa::path(patch, path = "/api/servers/{id}/channels", tag = "channels", params(("id" = Id, Path)),
    request_body = Vec<ChannelPosition>, responses((status = 200, body = Vec<Channel>)))]
pub async fn reorder(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Json(body): Json<Vec<ChannelPosition>>,
) -> AppResult<Json<Vec<Channel>>> {
    let member = permissions::member(&state, id, auth.id).await?;
    member.require(bits::MANAGE_CHANNELS)?;
    if body.len() > 500 {
        return Err(AppError::bad("too many channels"));
    }
    let rows = repo::list_for_server(&state, id).await?;
    let find = |cid: Id| rows.iter().find(|r| r.id == cid);
    let mut moves = Vec::with_capacity(body.len());
    for entry in &body {
        let row = find(entry.id).ok_or(AppError::bad("channel is not in this server"))?;
        if let Some(parent) = entry.parent_id {
            let parent_row = find(parent).ok_or(AppError::bad("parent is not in this server"))?;
            if row.kind == ChannelType::Category || parent_row.kind != ChannelType::Category {
                return Err(AppError::bad("channels can only be placed inside a category"));
            }
        }
        if row.position != entry.position || row.parent_id != entry.parent_id {
            moves.push((entry.id, entry.position.max(0), entry.parent_id));
        }
    }
    repo::reorder(&state, &moves).await?;

    let ctx = permissions::context(&state, id).await?;
    let updated = repo::list_for_server(&state, id).await?;
    for (cid, _, _) in &moves {
        if let Some(row) = updated.iter().find(|r| r.id == *cid) {
            let channel = server_channel(&ctx, row.clone());
            gateway::publish(
                &state,
                Target::Channel {
                    server: Some(id),
                    channel: *cid,
                },
                Event::new("CHANNEL_UPDATE", &channel),
            )
            .await;
        }
    }
    Ok(Json(
        updated
            .into_iter()
            .filter(|r| member.channel(r.id) & bits::VIEW_CHANNEL != 0)
            .map(|r| server_channel(&ctx, r))
            .collect(),
    ))
}
