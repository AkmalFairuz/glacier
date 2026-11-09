use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::id::Id;
use crate::users::User;

#[derive(Clone, Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct Attachment {
    pub id: Id,
    pub url: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct Reaction {
    pub emoji: String,
    pub user_ids: Vec<Id>,
}

/// Compact copy of the message a reply points at.
#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct ReferencedMessage {
    pub id: Id,
    pub author: User,
    /// The first 200 characters.
    pub content: String,
    pub has_attachments: bool,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct Message {
    pub id: Id,
    pub channel_id: Id,
    pub author: User,
    pub content: String,
    /// Set when this message is a reply, even if the original was deleted since.
    pub reply_to_id: Option<Id>,
    /// The original message; `null` with `reply_to_id` set means it was deleted.
    pub referenced_message: Option<ReferencedMessage>,
    pub attachments: Vec<Attachment>,
    pub reactions: Vec<Reaction>,
    pub edited_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
pub struct MessageRow {
    pub id: Id,
    pub channel_id: Id,
    pub author_id: Id,
    pub content: String,
    pub reply_to_id: Option<Id>,
    pub edited_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize, IntoParams)]
pub struct ListQuery {
    /// Return messages older than this id.
    pub before: Option<Id>,
    /// 1-100, default 50.
    pub limit: Option<u32>,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateMessage {
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub attachment_ids: Vec<Id>,
    /// Id of a message in the same channel to reply to.
    #[serde(default)]
    pub reply_to: Option<Id>,
}

#[derive(Deserialize, ToSchema)]
pub struct EditMessage {
    pub content: String,
}
