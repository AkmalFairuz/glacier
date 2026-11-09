use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::id::Id;
use crate::permissions::{Overwrite, TargetType};
use crate::users::User;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ChannelType {
    Text,
    Voice,
    Category,
    Dm,
    GroupDm,
}

crate::db::sql_string_enum!(ChannelType {
    Text => "text",
    Voice => "voice",
    Category => "category",
    Dm => "dm",
    GroupDm => "group_dm",
});

impl ChannelType {
    pub fn is_dm(self) -> bool {
        matches!(self, Self::Dm | Self::GroupDm)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChannelRow {
    pub id: Id,
    pub server_id: Option<Id>,
    #[sqlx(rename = "type")]
    pub kind: ChannelType,
    pub name: Option<String>,
    pub topic: Option<String>,
    pub parent_id: Option<Id>,
    pub position: i32,
    pub user_limit: Option<u16>,
    /// Defaulted so channel rows cached in Redis before this column existed still load.
    #[serde(default)]
    pub rate_limit_per_user: u32,
    pub owner_id: Option<Id>,
    pub last_message_id: Option<Id>,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct Channel {
    pub id: Id,
    pub server_id: Option<Id>,
    #[serde(rename = "type")]
    pub kind: ChannelType,
    pub name: Option<String>,
    pub topic: Option<String>,
    pub parent_id: Option<Id>,
    pub position: i32,
    /// Voice channels only: most people allowed at once (1-100), or null for no limit.
    pub user_limit: Option<u16>,
    /// Slowmode: seconds a member must wait between messages; 0 is off. Members with
    /// Manage Messages or Manage Channels are exempt.
    pub rate_limit_per_user: u32,
    /// Empty for DMs.
    pub overwrites: Vec<Overwrite>,
    /// All participants (including the caller) for DMs; empty for server channels.
    pub recipients: Vec<User>,
    pub owner_id: Option<Id>,
    pub last_message_id: Option<Id>,
}

impl Channel {
    pub fn from_row(row: ChannelRow, overwrites: Vec<Overwrite>, recipients: Vec<User>) -> Self {
        Self {
            id: row.id,
            server_id: row.server_id,
            kind: row.kind,
            name: row.name,
            topic: row.topic,
            parent_id: row.parent_id,
            position: row.position,
            user_limit: row.user_limit,
            rate_limit_per_user: row.rate_limit_per_user,
            overwrites,
            recipients,
            owner_id: row.owner_id,
            last_message_id: row.last_message_id,
        }
    }
}

#[derive(Deserialize, ToSchema)]
pub struct CreateChannel {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: ChannelType,
    pub parent_id: Option<Id>,
    pub topic: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateChannel {
    pub name: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub topic: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub parent_id: Option<Option<Id>>,
    pub position: Option<i32>,
    /// Voice channels: 1-100, or null to remove the limit.
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub user_limit: Option<Option<u16>>,
    /// Text channels: slowmode in seconds, 0 (off) to 21600 (6 hours).
    pub rate_limit_per_user: Option<u32>,
}

#[derive(Deserialize, ToSchema)]
pub struct PutOverwrite {
    pub target_type: TargetType,
    pub allow: u64,
    pub deny: u64,
}

/// One entry of a bulk reorder: where a channel now sits.
#[derive(Deserialize, ToSchema)]
pub struct ChannelPosition {
    pub id: Id,
    pub position: i32,
    pub parent_id: Option<Id>,
}
