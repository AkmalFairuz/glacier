use axum::extract::FromRequestParts;
use axum::http::request::Parts;

use crate::error::AppError;
use crate::id::Id;
use crate::state::AppState;

use super::session;

/// Authenticated caller, resolved from `Authorization: Bearer <token>`.
pub struct AuthUser {
    pub id: Id,
    pub token_hash: String,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(AppError::Unauthorized)?;
        let id = session::resolve(state, token).await?.ok_or(AppError::Unauthorized)?;
        Ok(Self {
            id,
            token_hash: session::hash_token(token),
        })
    }
}
