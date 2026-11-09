use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::json;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::permissions::{self, bits, Member};
use crate::state::AppState;

use super::models::{CreateRole, Role, UpdateRole};
use super::repo;

fn clean_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 64 {
        return Err(AppError::bad("role name must be 1-64 characters"));
    }
    Ok(name.to_string())
}

/// Non-owners may only grant permissions they hold themselves.
fn check_grant(me: &Member, perms: u64) -> AppResult<()> {
    if perms & !bits::ALL != 0 {
        return Err(AppError::bad("unknown permission bits"));
    }
    if !me.is_owner() && perms & !me.base() != 0 {
        return Err(AppError::Forbidden("cannot grant permissions you do not have"));
    }
    Ok(())
}

fn check_rank(me: &Member, role: &Role) -> AppResult<()> {
    if !me.is_owner() && !role.is_default && role.position >= me.top_position() {
        return Err(AppError::Forbidden(
            "cannot manage a role at or above your highest role",
        ));
    }
    Ok(())
}

async fn changed(state: &AppState, server: Id, event: Event) {
    if let Err(e) = permissions::bump(state, server).await {
        tracing::warn!(error = %e, "permission version bump failed");
    }
    gateway::publish(state, Target::Server(server), event).await;
    gateway::publish(
        state,
        Target::Server(server),
        Event::new("PERMISSIONS_CHANGED", json!({ "server_id": server })),
    )
    .await;
}

#[utoipa::path(get, path = "/api/servers/{id}/roles", tag = "roles", params(("id" = Id, Path)), responses((status = 200, body = Vec<Role>)))]
pub async fn list(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<Json<Vec<Role>>> {
    permissions::member(&state, id, auth.id).await?;
    Ok(Json(repo::list(&state, id).await?))
}

#[utoipa::path(post, path = "/api/servers/{id}/roles", tag = "roles", params(("id" = Id, Path)), request_body = CreateRole, responses((status = 200, body = Role)))]
pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Json(body): Json<CreateRole>,
) -> AppResult<Json<Role>> {
    let me = permissions::member(&state, id, auth.id).await?;
    me.require(bits::MANAGE_ROLES)?;
    let perms = body.permissions.unwrap_or(0);
    check_grant(&me, perms)?;
    let role_id = repo::create(&state, id, &clean_name(&body.name)?, body.color, perms).await?;
    let role = repo::get(&state, id, role_id).await?;
    changed(&state, id, Event::new("ROLE_CREATE", &role)).await;
    Ok(Json(role))
}

#[utoipa::path(patch, path = "/api/servers/{id}/roles/{rid}", tag = "roles",
    params(("id" = Id, Path), ("rid" = Id, Path)), request_body = UpdateRole, responses((status = 200, body = Role)))]
pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, rid)): Path<(Id, Id)>,
    Json(body): Json<UpdateRole>,
) -> AppResult<Json<Role>> {
    let me = permissions::member(&state, id, auth.id).await?;
    me.require(bits::MANAGE_ROLES)?;
    let mut role = repo::get(&state, id, rid).await?;
    check_rank(&me, &role)?;
    if let Some(name) = body.name {
        role.name = clean_name(&name)?;
    }
    if let Some(color) = body.color {
        role.color = color.map(|c| c & 0xFF_FFFF);
    }
    if let Some(perms) = body.permissions {
        check_grant(&me, perms)?;
        role.permissions = perms;
    }
    repo::update(&state, &role).await?;
    if let (Some(position), false) = (body.position, role.is_default) {
        if !me.is_owner() && position >= me.top_position() {
            return Err(AppError::Forbidden("cannot move a role above your highest role"));
        }
        repo::reorder(&state, id, rid, position).await?;
        for other in repo::list(&state, id).await?.into_iter().filter(|r| r.id != rid) {
            gateway::publish(&state, Target::Server(id), Event::new("ROLE_UPDATE", &other)).await;
        }
    }
    let role = repo::get(&state, id, rid).await?;
    changed(&state, id, Event::new("ROLE_UPDATE", &role)).await;
    Ok(Json(role))
}

#[utoipa::path(delete, path = "/api/servers/{id}/roles/{rid}", tag = "roles", params(("id" = Id, Path), ("rid" = Id, Path)), responses((status = 204)))]
pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, rid)): Path<(Id, Id)>,
) -> AppResult<StatusCode> {
    let me = permissions::member(&state, id, auth.id).await?;
    me.require(bits::MANAGE_ROLES)?;
    let role = repo::get(&state, id, rid).await?;
    if role.is_default {
        return Err(AppError::bad("the @everyone role cannot be deleted"));
    }
    check_rank(&me, &role)?;
    repo::delete(&state, rid).await?;
    changed(
        &state,
        id,
        Event::new("ROLE_DELETE", json!({ "server_id": id, "id": rid })),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}
