use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::gateway::presence::{self, CustomStatus, PresenceSettings};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::servers;
use crate::state::AppState;

use super::models::{NoteBody, SearchQuery, UpdatePresence, UpdateUser, User, UserProfile};
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
    let presence = presence::presence_of(&state, id).await?;
    Ok(Json(UserProfile {
        user,
        presence,
        mutual_servers,
        note,
    }))
}

/// Trims a custom status and rejects bad input; an empty one counts as cleared.
fn clean_custom_status(input: CustomStatus) -> AppResult<Option<CustomStatus>> {
    let text = input.text.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
    let emoji = input.emoji.map(|e| e.trim().to_string()).filter(|e| !e.is_empty());
    if text.as_ref().is_some_and(|t| t.chars().count() > 128) {
        return Err(AppError::bad("custom status must be at most 128 characters"));
    }
    if emoji.as_ref().is_some_and(|e| e.chars().count() > 16) {
        return Err(AppError::bad("custom status emoji must be a single emoji"));
    }
    if input.expires_at.is_some_and(|t| t <= chrono::Utc::now()) {
        return Err(AppError::bad("custom status expiry must be in the future"));
    }
    Ok((text.is_some() || emoji.is_some()).then_some(CustomStatus {
        text,
        emoji,
        expires_at: input.expires_at,
    }))
}

#[utoipa::path(patch, path = "/api/users/@me/presence", tag = "users", request_body = UpdatePresence,
    responses((status = 200, body = PresenceSettings)))]
pub async fn update_presence(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdatePresence>,
) -> AppResult<Json<PresenceSettings>> {
    crate::ratelimit::check(&state, "presence", &auth.id.to_string(), 20, 60).await?;
    let current = presence::settings(&state, auth.id).await?;
    let status = body.status.unwrap_or(current.status);
    let custom = match body.custom_status {
        None => current.custom_status,
        Some(None) => None,
        Some(Some(input)) => clean_custom_status(input)?,
    };
    let before = presence::presence_of(&state, auth.id).await?;
    repo::set_presence(&state, auth.id, status, custom.as_ref()).await?;
    presence::broadcast_if_changed(&state, auth.id, &before).await;
    let settings = presence::settings(&state, auth.id).await?;
    // Keeps the status picker in sync across the user's other tabs and devices.
    gateway::publish(
        &state,
        Target::User(auth.id),
        Event::new("PRESENCE_SETTINGS_UPDATE", &settings),
    )
    .await;
    Ok(Json(settings))
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
