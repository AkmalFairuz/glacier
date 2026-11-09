use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::servers;
use crate::state::AppState;

use super::models::{NoteBody, SearchQuery, UpdateUser, User, UserProfile};
use super::repo;

#[utoipa::path(get, path = "/api/users/@me", tag = "users", responses((status = 200, body = User)))]
pub async fn me(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<User>> {
    Ok(Json(repo::get(&state, auth.id).await?))
}

#[utoipa::path(patch, path = "/api/users/@me", tag = "users", request_body = UpdateUser, responses((status = 200, body = User)))]
pub async fn update_me(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdateUser>,
) -> AppResult<Json<User>> {
    let current = repo::get(&state, auth.id).await?;
    let display_name = body
        .display_name
        .map(|s| s.trim().to_string())
        .unwrap_or(current.display_name);
    if display_name.is_empty() || display_name.chars().count() > 64 {
        return Err(AppError::bad("display name must be 1-64 characters"));
    }
    let avatar = body.avatar_url.unwrap_or(current.avatar_url);
    let bio = body
        .bio
        .unwrap_or(current.bio)
        .map(|b| b.trim().to_string())
        .filter(|b| !b.is_empty());
    if bio.as_ref().is_some_and(|b| b.chars().count() > 190) {
        return Err(AppError::bad("about me must be at most 190 characters"));
    }
    let banner_color = body.banner_color.unwrap_or(current.banner_color).map(|c| c & 0xFF_FFFF);
    let fields = repo::ProfileFields {
        display_name: &display_name,
        avatar_url: avatar.as_deref(),
        bio: bio.as_deref(),
        banner_color,
    };
    let user = repo::update(&state, auth.id, fields).await?;
    gateway::publish(&state, Target::User(auth.id), Event::new("USER_UPDATE", &user)).await;
    Ok(Json(user))
}

#[utoipa::path(get, path = "/api/users/search", tag = "users", params(SearchQuery), responses((status = 200, body = Vec<User>)))]
pub async fn search(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<SearchQuery>,
) -> AppResult<Json<Vec<User>>> {
    let q = q.q.trim().to_lowercase();
    if q.is_empty() {
        return Ok(Json(vec![]));
    }
    Ok(Json(repo::search(&state, &q, auth.id).await?))
}

#[derive(Serialize, ToSchema)]
pub struct IceServer {
    pub urls: Vec<String>,
}

#[derive(Serialize, ToSchema)]
pub struct IceConfig {
    pub ice_servers: Vec<IceServer>,
}

#[utoipa::path(get, path = "/api/config/ice", tag = "users", responses((status = 200, body = IceConfig)))]
pub async fn ice_config(State(state): State<AppState>) -> Json<IceConfig> {
    Json(IceConfig {
        ice_servers: vec![IceServer {
            urls: state.stun_urls.clone(),
        }],
    })
}

#[utoipa::path(get, path = "/api/users/{id}/profile", tag = "users", params(("id" = Id, Path)), responses((status = 200, body = UserProfile)))]
pub async fn profile(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
) -> AppResult<Json<UserProfile>> {
    let user = repo::get(&state, id).await?;
    let mutual_servers = if id == auth.id {
        vec![]
    } else {
        servers::repo::mutual(&state, auth.id, id).await?
    };
    let note = repo::note(&state, auth.id, id).await?;
    Ok(Json(UserProfile {
        user,
        mutual_servers,
        note,
    }))
}

#[utoipa::path(put, path = "/api/users/{id}/note", tag = "users", params(("id" = Id, Path)), request_body = NoteBody, responses((status = 204)))]
pub async fn set_note(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Json(body): Json<NoteBody>,
) -> AppResult<StatusCode> {
    let note = body.note.trim();
    if note.chars().count() > 256 {
        return Err(AppError::bad("notes are limited to 256 characters"));
    }
    repo::get(&state, id).await?;
    repo::set_note(&state, auth.id, id, note).await?;
    Ok(StatusCode::NO_CONTENT)
}
