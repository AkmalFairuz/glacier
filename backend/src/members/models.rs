use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::gateway::presence::{CustomStatus, Status};
use crate::id::Id;
use crate::users::User;

#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct Member {
    pub server_id: Id,
    pub user: User,
    pub nickname: Option<String>,
    pub role_ids: Vec<Id>,
    pub joined_at: DateTime<Utc>,
    /// Same as `status != offline`.
    pub online: bool,
    pub status: Status,
    pub custom_status: Option<CustomStatus>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateMember {
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub nickname: Option<Option<String>>,
    pub role_ids: Option<Vec<Id>>,
}

#[derive(Serialize, ToSchema)]
pub struct Ban {
    pub user: User,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema, Default)]
pub struct BanBody {
    pub reason: Option<String>,
}
