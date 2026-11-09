use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{Duration, Utc};

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::members;
use crate::permissions::{self, bits};
use crate::servers::{self, Server};
use crate::state::AppState;
use crate::users;

use super::models::{CreateInvite, Invite};
use super::repo;

#[utoipa::path(post, path = "/api/servers/{id}/invites", tag = "invites", params(("id" = Id, Path)),
    request_body = CreateInvite, responses((status = 200, body = Invite)))]
pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    body: Option<Json<CreateInvite>>,
) -> AppResult<Json<Invite>> {
    permissions::member(&state, id, auth.id)
        .await?
        .require(bits::CREATE_INVITE)?;
    let body = body.map(|Json(b)| b).unwrap_or_default();
    let max_uses = body.max_uses.filter(|m| *m > 0);
    let expires_at = body
        .expires_in_secs
        .filter(|s| *s > 0)
        .map(|s| Utc::now() + Duration::seconds(s.min(60 * 60 * 24 * 365) as i64));
    let code = repo::create(&state, id, auth.id, max_uses, expires_at).await?;
    let row = repo::get(&state, &code).await?;
    let inviter = users::repo::get(&state, row.inviter_id).await.ok();
    Ok(Json(Invite::new(row, servers::repo::get(&state, id).await?, inviter)))
}

#[utoipa::path(get, path = "/api/servers/{id}/invites", tag = "invites", params(("id" = Id, Path)), responses((status = 200, body = Vec<Invite>)))]
pub async fn list(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<Json<Vec<Invite>>> {
    permissions::member(&state, id, auth.id)
        .await?
        .require(bits::MANAGE_SERVER)?;
    let server = servers::repo::get(&state, id).await?;
    let rows = repo::list(&state, id).await?;
    let ids: Vec<Id> = rows.iter().map(|r| r.inviter_id).collect();
    let inviters = users::repo::get_many(&state, &ids).await?;
    Ok(Json(
        rows.into_iter()
            .map(|r| {
                let inviter = inviters.iter().find(|u| u.id == r.inviter_id).cloned();
                Invite::new(r, server.clone(), inviter)
            })
            .collect(),
    ))
}

#[utoipa::path(get, path = "/api/invites/{code}", tag = "invites", security(()), params(("code" = String, Path)), responses((status = 200, body = Invite)))]
pub async fn preview(State(state): State<AppState>, Path(code): Path<String>) -> AppResult<Json<Invite>> {
    let row = repo::get(&state, &code).await?;
    if !row.is_usable() {
        return Err(AppError::NotFound("invite"));
    }
    let server = servers::repo::get(&state, row.server_id).await?;
    let inviter = users::repo::get(&state, row.inviter_id).await.ok();
    Ok(Json(Invite::new(row, server, inviter)))
}

#[utoipa::path(post, path = "/api/invites/{code}", tag = "invites", params(("code" = String, Path)), responses((status = 200, body = Server)))]
pub async fn accept(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(code): Path<String>,
) -> AppResult<Json<Server>> {
    let row = repo::get(&state, &code).await?;
    if permissions::is_member(&state, row.server_id, auth.id).await? {
        return Ok(Json(servers::repo::get(&state, row.server_id).await?));
    }
    if servers::repo::is_banned(&state, row.server_id, auth.id).await? {
        return Err(AppError::Forbidden("you are banned from this server"));
    }
    if !repo::consume(&state, &code).await? {
        return Err(AppError::NotFound("invite"));
    }
    Ok(Json(members::join(&state, row.server_id, auth.id).await?))
}

#[utoipa::path(delete, path = "/api/invites/{code}", tag = "invites", params(("code" = String, Path)), responses((status = 204)))]
pub async fn delete(State(state): State<AppState>, auth: AuthUser, Path(code): Path<String>) -> AppResult<StatusCode> {
    let row = repo::get(&state, &code).await?;
    let member = permissions::member(&state, row.server_id, auth.id).await?;
    if row.inviter_id != auth.id {
        member.require(bits::MANAGE_SERVER)?;
    }
    repo::delete(&state, &code).await?;
    Ok(StatusCode::NO_CONTENT)
}
