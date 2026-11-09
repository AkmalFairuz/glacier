use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::id::Id;

#[derive(Clone, Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct Role {
    pub id: Id,
    pub server_id: Id,
    pub name: String,
    /// 0xRRGGBB
    pub color: Option<u32>,
    pub permissions: u64,
    pub position: i32,
    /// The @everyone role; its id equals the server id.
    pub is_default: bool,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateRole {
    pub name: String,
    pub color: Option<u32>,
    pub permissions: Option<u64>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateRole {
    pub name: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub color: Option<Option<u32>>,
    pub permissions: Option<u64>,
    pub position: Option<i32>,
}
