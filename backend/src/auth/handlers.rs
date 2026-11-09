use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;

use crate::error::{AppError, AppResult, ErrorBody};
use crate::state::AppState;
use crate::{ratelimit, users};

use super::models::{AuthResponse, ChangePasswordBody, LoginBody, RegisterBody};
use super::{password, repo, session, AuthUser};

fn valid_username(name: &str) -> bool {
    (2..=32).contains(&name.len())
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '.')
}

#[utoipa::path(post, path = "/api/auth/register", tag = "auth", security(()), request_body = RegisterBody,
    responses((status = 200, body = AuthResponse), (status = 409, body = ErrorBody)))]
pub async fn register(State(state): State<AppState>, Json(body): Json<RegisterBody>) -> AppResult<Json<AuthResponse>> {
    let username = body.username.trim().to_lowercase();
    if !valid_username(&username) {
        return Err(AppError::bad("username must be 2-32 characters: a-z, 0-9, _ or ."));
    }
    if body.password.len() < 8 || body.password.len() > 128 {
        return Err(AppError::bad("password must be 8-128 characters"));
    }
    let display_name = body
        .display_name
        .map(|d| d.trim().to_string())
        .filter(|d| !d.is_empty());
    let display_name = display_name.unwrap_or_else(|| username.clone());
    if display_name.chars().count() > 64 {
        return Err(AppError::bad("display name must be at most 64 characters"));
    }
    ratelimit::check(&state, "register", &username, 5, 60).await?;

    let hash = password::hash(body.password).await?;
    let id = state.ids.next();
    repo::insert_user(&state, id, &username, &display_name, &hash)
        .await
        .map_err(|e| match e {
            AppError::Conflict(_) => AppError::Conflict("username is taken".into()),
            other => other,
        })?;
    let token = session::create(&state, id).await?;
    let user = users::repo::get(&state, id).await?;
    Ok(Json(AuthResponse { token, user }))
}

#[utoipa::path(post, path = "/api/auth/login", tag = "auth", security(()), request_body = LoginBody,
    responses((status = 200, body = AuthResponse), (status = 400, body = ErrorBody)))]
pub async fn login(State(state): State<AppState>, Json(body): Json<LoginBody>) -> AppResult<Json<AuthResponse>> {
    let username = body.username.trim().to_lowercase();
    ratelimit::check(&state, "login", &username, 10, 60).await?;
    let creds = repo::credentials(&state, &username).await?;
    let Some(creds) = creds else {
        return Err(AppError::bad("invalid username or password"));
    };
    if !password::verify(body.password, creds.password_hash).await? {
        return Err(AppError::bad("invalid username or password"));
    }
    let token = session::create(&state, creds.id).await?;
    let user = users::repo::get(&state, creds.id).await?;
    Ok(Json(AuthResponse { token, user }))
}

#[utoipa::path(post, path = "/api/auth/logout", tag = "auth", responses((status = 204)))]
pub async fn logout(State(state): State<AppState>, auth: AuthUser) -> AppResult<StatusCode> {
    session::revoke(&state, &auth.token_hash).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(post, path = "/api/auth/password", tag = "auth", request_body = ChangePasswordBody,
    responses((status = 204, description = "Password changed; all other sessions are signed out"), (status = 400, body = ErrorBody)))]
pub async fn change_password(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<ChangePasswordBody>,
) -> AppResult<StatusCode> {
    ratelimit::check(&state, "password", &auth.id.to_string(), 5, 60).await?;
    if body.new_password.len() < 8 || body.new_password.len() > 128 {
        return Err(AppError::bad("new password must be 8-128 characters"));
    }
    let current = repo::password_hash(&state, auth.id).await?;
    if !password::verify(body.current_password, current).await? {
        return Err(AppError::bad("current password is incorrect"));
    }
    let hash = password::hash(body.new_password).await?;
    repo::set_password_hash(&state, auth.id, &hash).await?;
    session::revoke_others(&state, auth.id, &auth.token_hash).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(post, path = "/api/auth/sessions/revoke-others", tag = "auth",
    responses((status = 200, body = RevokedSessions)))]
pub async fn revoke_other_sessions(State(state): State<AppState>, auth: AuthUser) -> AppResult<Json<RevokedSessions>> {
    let revoked = session::revoke_others(&state, auth.id, &auth.token_hash).await?;
    Ok(Json(RevokedSessions { revoked }))
}

#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct RevokedSessions {
    pub revoked: u64,
}

#[cfg(test)]
mod tests {
    use super::valid_username;

    #[test]
    fn username_rules() {
        assert!(valid_username("kira_01"));
        assert!(!valid_username("K"));
        assert!(!valid_username("has space"));
        assert!(!valid_username("UPPER"));
    }
}
