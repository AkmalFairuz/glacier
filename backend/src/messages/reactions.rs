use axum::extract::{Path, State};
use axum::http::StatusCode;
use serde_json::json;

use crate::auth::AuthUser;
use crate::channels;
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event};
use crate::id::Id;
use crate::permissions::bits;
use crate::state::AppState;

use super::repo;

fn clean_emoji(emoji: &str) -> AppResult<&str> {
    let emoji = emoji.trim();
    if emoji.is_empty()
        || emoji.chars().count() > 16
        || emoji.chars().any(|c| c.is_ascii_alphanumeric() || c.is_whitespace())
    {
        return Err(AppError::bad("invalid emoji"));
    }
    Ok(emoji)
}

#[utoipa::path(put, path = "/api/channels/{cid}/messages/{mid}/reactions/{emoji}", tag = "messages",
    params(("cid" = Id, Path), ("mid" = Id, Path), ("emoji" = String, Path, description = "URL-encoded unicode emoji")),
    responses((status = 204)))]
pub async fn add(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((cid, mid, emoji)): Path<(Id, Id, String)>,
) -> AppResult<StatusCode> {
    let access = channels::access(&state, cid, auth.id).await?;
    access.require(bits::ADD_REACTIONS)?;
    let emoji = clean_emoji(&emoji)?;
    repo::author_of(&state, cid, mid).await?;
    if repo::add_reaction(&state, mid, auth.id, emoji).await? {
        let d = json!({ "channel_id": cid, "message_id": mid, "user_id": auth.id, "emoji": emoji });
        gateway::publish(&state, access.target(), Event::new("REACTION_ADD", d)).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(delete, path = "/api/channels/{cid}/messages/{mid}/reactions/{emoji}", tag = "messages",
    params(("cid" = Id, Path), ("mid" = Id, Path), ("emoji" = String, Path, description = "URL-encoded unicode emoji")),
    responses((status = 204)))]
pub async fn remove(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((cid, mid, emoji)): Path<(Id, Id, String)>,
) -> AppResult<StatusCode> {
    let access = channels::access(&state, cid, auth.id).await?;
    let emoji = clean_emoji(&emoji)?;
    if repo::remove_reaction(&state, mid, auth.id, emoji).await? {
        let d = json!({ "channel_id": cid, "message_id": mid, "user_id": auth.id, "emoji": emoji });
        gateway::publish(&state, access.target(), Event::new("REACTION_REMOVE", d)).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::clean_emoji;

    #[test]
    fn emoji_validation() {
        assert!(clean_emoji("👍").is_ok());
        assert!(clean_emoji("❤️").is_ok());
        assert!(clean_emoji("abc").is_err());
        assert!(clean_emoji("").is_err());
    }
}
