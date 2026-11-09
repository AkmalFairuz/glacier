use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::id::Id;

#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct User {
    pub id: Id,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    /// "About me", up to 190 characters.
    pub bio: Option<String>,
    /// Profile banner color, 0xRRGGBB.
    pub banner_color: Option<u32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateUser {
    pub display_name: Option<String>,
    /// `null` clears the avatar; omit to keep it.
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub avatar_url: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub bio: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub banner_color: Option<Option<u32>>,
}

#[derive(Deserialize, IntoParams)]
pub struct SearchQuery {
    pub q: String,
}

/// A user as seen by the caller: shared servers and the caller's private note.
#[derive(Serialize, ToSchema)]
pub struct UserProfile {
    pub user: User,
    pub mutual_servers: Vec<crate::servers::Server>,
    /// Only visible to the caller.
    pub note: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct NoteBody {
    /// Empty clears the note.
    pub note: String,
}
