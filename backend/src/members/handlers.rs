use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::permissions::{self, bits};
use crate::state::AppState;

use super::models::{Ban, BanBody, Member, UpdateMember};
use super::repo;

/// Accepts a user id or `@me`.
fn user_ref(raw: &str, auth: &AuthUser) -> AppResult<Id> {
    if raw == "@me" {
        return Ok(auth.id);
    }
    raw.parse().map_err(|_| AppError::bad("invalid user id"))
}

#[utoipa::path(get, path = "/api/servers/{id}/members", tag = "members", params(("id" = Id, Path)), responses((status = 200, body = Vec<Member>)))]
pub async fn list(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<Json<Vec<Member>>> {
    permissions::member(&state, id, auth.id).await?;
    Ok(Json(repo::list(&state, id).await?))
}

#[utoipa::path(patch, path = "/api/servers/{id}/members/{uid}", tag = "members",
    params(("id" = Id, Path), ("uid" = String, Path, description = "user id or @me")),
    request_body = UpdateMember, responses((status = 200, body = Member)))]
pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, uid)): Path<(Id, String)>,
    Json(body): Json<UpdateMember>,
) -> AppResult<Json<Member>> {
    let uid = user_ref(&uid, &auth)?;
    let me = permissions::member(&state, id, auth.id).await?;
    let target = permissions::member(&state, id, uid)
        .await
        .map_err(|_| AppError::NotFound("member"))?;

    if let Some(nickname) = body.nickname {
        if uid != auth.id {
            me.require(bits::MANAGE_ROLES)?;
        }
        let nickname = nickname.map(|n| n.trim().to_string()).filter(|n| !n.is_empty());
        if nickname.as_ref().is_some_and(|n| n.chars().count() > 64) {
            return Err(AppError::bad("nickname must be at most 64 characters"));
        }
        repo::set_nickname(&state, id, uid, nickname.as_deref()).await?;
    }

    if let Some(mut role_ids) = body.role_ids {
        me.require(bits::MANAGE_ROLES)?;
        role_ids.sort();
        role_ids.dedup();
        role_ids.retain(|r| *r != id);
        let top = me.top_position();
        let changed = role_ids
            .iter()
            .filter(|r| !target.role_ids.contains(r))
            .chain(target.role_ids.iter().filter(|r| !role_ids.contains(r)));
        for role in changed {
            let info = me.ctx.roles.get(role).ok_or(AppError::bad("unknown role"))?;
            if !me.is_owner() && info.position >= top {
                return Err(AppError::Forbidden(
                    "cannot manage a role at or above your highest role",
                ));
            }
        }
        repo::set_roles(&state, id, uid, &role_ids).await?;
        permissions::forget_member(&state, id, uid).await?;
    }

    let member = repo::get(&state, id, uid).await?;
    super::announce_update(&state, &member).await;
    Ok(Json(member))
}

#[utoipa::path(delete, path = "/api/servers/{id}/members/{uid}", tag = "members",
    params(("id" = Id, Path), ("uid" = String, Path, description = "user id, or @me to leave")),
    responses((status = 204)))]
pub async fn remove(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, uid)): Path<(Id, String)>,
) -> AppResult<StatusCode> {
    let uid = user_ref(&uid, &auth)?;
    let me = permissions::member(&state, id, auth.id).await?;
    if uid == auth.id {
        if me.is_owner() {
            return Err(AppError::bad("the owner cannot leave; delete the server instead"));
        }
    } else {
        me.require(bits::KICK_MEMBERS)?;
        check_outranks(&state, &me, id, uid).await?;
    }
    repo::remove(&state, id, uid).await?;
    super::announce_removal(&state, id, uid).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn check_outranks(state: &AppState, me: &permissions::Member, server: Id, target: Id) -> AppResult<()> {
    let target = permissions::member(state, server, target)
        .await
        .map_err(|_| AppError::NotFound("member"))?;
    if target.is_owner() || (!me.is_owner() && target.top_position() >= me.top_position()) {
        return Err(AppError::Forbidden("target has an equal or higher role"));
    }
    Ok(())
}

#[utoipa::path(get, path = "/api/servers/{id}/bans", tag = "members", params(("id" = Id, Path)), responses((status = 200, body = Vec<Ban>)))]
pub async fn bans(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<Json<Vec<Ban>>> {
    permissions::member(&state, id, auth.id)
        .await?
        .require(bits::BAN_MEMBERS)?;
    Ok(Json(repo::bans(&state, id).await?))
}

#[utoipa::path(put, path = "/api/servers/{id}/bans/{uid}", tag = "members",
    params(("id" = Id, Path), ("uid" = Id, Path)), request_body = BanBody, responses((status = 204)))]
pub async fn ban(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, uid)): Path<(Id, Id)>,
    body: Option<Json<BanBody>>,
) -> AppResult<StatusCode> {
    let me = permissions::member(&state, id, auth.id).await?;
    me.require(bits::BAN_MEMBERS)?;
    if uid == auth.id {
        return Err(AppError::bad("you cannot ban yourself"));
    }
    let was_member = permissions::is_member(&state, id, uid).await?;
    if was_member {
        check_outranks(&state, &me, id, uid).await?;
    }
    let reason = body
        .and_then(|Json(b)| b.reason)
        .map(|r| r.trim().chars().take(512).collect::<String>());
    repo::ban(&state, id, uid, reason.as_deref().filter(|r| !r.is_empty())).await?;
    if was_member {
        super::announce_removal(&state, id, uid).await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(delete, path = "/api/servers/{id}/bans/{uid}", tag = "members",
    params(("id" = Id, Path), ("uid" = Id, Path)), responses((status = 204)))]
pub async fn unban(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, uid)): Path<(Id, Id)>,
) -> AppResult<StatusCode> {
    permissions::member(&state, id, auth.id)
        .await?
        .require(bits::BAN_MEMBERS)?;
    repo::unban(&state, id, uid).await?;
    Ok(StatusCode::NO_CONTENT)
}
