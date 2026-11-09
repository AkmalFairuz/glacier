use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::id::Id;

#[derive(Clone, Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct ReadState {
    pub channel_id: Id,
    pub last_read_message_id: Id,
}

/// How far another DM participant has read.
#[derive(Clone, Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct ReadReceipt {
    pub user_id: Id,
    pub last_read_message_id: Id,
}

/// Latest message of a channel the user can see (for unread badges).
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct ChannelHead {
    pub channel_id: Id,
    pub server_id: Option<Id>,
    pub last_message_id: Id,
}

#[derive(Deserialize, ToSchema)]
pub struct AckBody {
    pub message_id: Id,
}

/// Messages from others the user has not read yet in one DM.
#[derive(Clone, Debug, Serialize, sqlx::FromRow)]
pub struct UnreadCount {
    pub channel_id: Id,
    pub count: i64,
}
