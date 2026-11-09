use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::json;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::members;
use crate::permissions::{self, bits, Effective};
use crate::state::AppState;

use super::models::{CreateServer, DiscoverQuery, Server, UpdateServer};
use super::repo::{self, NewServer};

fn clean_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 100 {
        return Err(AppError::bad("server name must be 1-100 characters"));
    }
    Ok(name.to_string())
}

#[utoipa::path(get, path = "/api/servers", tag = "servers", responses((status = 200, body = Vec<Server>)))]
pub async fn list(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<Vec<Server>>> {
    Ok(Json(repo::list_for_user(&state, auth.id).await?))
}

#[utoipa::path(post, path = "/api/servers", tag = "servers", request_body = CreateServer, responses((status = 200, body = Server)))]
pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateServer>,
) -> AppResult<Json<Server>> {
    let name = clean_name(&body.name)?;
    let description = body.description.as_deref().map(str::trim).filter(|d| !d.is_empty());
    let id = repo::create(
        &state,
        NewServer {
            name: &name,
            description,
            icon_url: body.icon_url.as_deref(),
            is_public: body.is_public,
            owner: auth.id,
            template: body.template,
        },
    )
    .await?;
    permissions::forget_member(&state, id, auth.id).await?;
    let server = repo::get(&state, id).await?;
    gateway::publish(&state, Target::User(auth.id), Event::new("SERVER_CREATE", &server)).await;
    Ok(Json(server))
}

#[utoipa::path(get, path = "/api/servers/discover", tag = "servers", params(DiscoverQuery), responses((status = 200, body = Vec<Server>)))]
pub async fn discover(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<DiscoverQuery>,
) -> AppResult<Json<Vec<Server>>> {
    Ok(Json(repo::discover(&state, q.q.as_deref().unwrap_or("").trim()).await?))
}

#[utoipa::path(get, path = "/api/servers/{id}", tag = "servers", params(("id" = Id, Path)), responses((status = 200, body = Server)))]
pub async fn get(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<Json<Server>> {
    let server = repo::get(&state, id).await?;
    if !server.is_public && !permissions::is_member(&state, id, auth.id).await? {
        return Err(AppError::NotFound("server"));
    }
    Ok(Json(server))
}

#[utoipa::path(patch, path = "/api/servers/{id}", tag = "servers", params(("id" = Id, Path)), request_body = UpdateServer, responses((status = 200, body = Server)))]
pub async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Json(body): Json<UpdateServer>,
) -> AppResult<Json<Server>> {
    permissions::member(&state, id, auth.id)
        .await?
        .require(bits::MANAGE_SERVER)?;
    let cur = repo::get(&state, id).await?;
    let name = match body.name {
        Some(n) => clean_name(&n)?,
        None => cur.name,
    };
    let description = body.description.unwrap_or(cur.description);
    let icon_url = body.icon_url.unwrap_or(cur.icon_url);
    let is_public = body.is_public.unwrap_or(cur.is_public);
    repo::update(
        &state,
        id,
        &name,
        description.as_deref(),
        is_public,
        icon_url.as_deref(),
    )
    .await?;
    let server = repo::get(&state, id).await?;
    gateway::publish(&state, Target::Server(id), Event::new("SERVER_UPDATE", &server)).await;
    Ok(Json(server))
}

#[utoipa::path(delete, path = "/api/servers/{id}", tag = "servers", params(("id" = Id, Path)), responses((status = 204)))]
pub async fn delete(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<StatusCode> {
    if !permissions::member(&state, id, auth.id).await?.is_owner() {
        return Err(AppError::Forbidden("only the owner can delete a server"));
    }
    // Notify before deleting so the audience can still be resolved.
    gateway::publish(
        &state,
        Target::Server(id),
        Event::new("SERVER_DELETE", json!({ "id": id })),
    )
    .await;
    repo::delete(&state, id).await?;
    permissions::bump(&state, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(post, path = "/api/servers/{id}/join", tag = "servers", params(("id" = Id, Path)), responses((status = 200, body = Server)))]
pub async fn join(State(state): State<AppState>, auth: AuthUser, Path(id): Path<Id>) -> AppResult<Json<Server>> {
    let server = repo::get(&state, id).await?;
    if !server.is_public {
        return Err(AppError::Forbidden("this server is invite-only"));
    }
    Ok(Json(members::join(&state, id, auth.id).await?))
}

#[utoipa::path(get, path = "/api/servers/{id}/permissions", tag = "servers", params(("id" = Id, Path)), responses((status = 200, body = Effective)))]
pub async fn my_permissions(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
) -> AppResult<Json<Effective>> {
    let member = permissions::member(&state, id, auth.id).await?;
    Ok(Json(permissions::effective(&member)))
}
