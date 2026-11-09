use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::id::Id;

#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Server {
    pub id: Id,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub owner_id: Id,
    pub is_public: bool,
    pub member_count: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateServer {
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub is_public: bool,
    pub icon_url: Option<String>,
    /// Starting channels; defaults to a blank server.
    #[serde(default)]
    pub template: super::templates::ServerTemplate,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateServer {
    pub name: Option<String>,
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub description: Option<Option<String>>,
    pub is_public: Option<bool>,
    #[serde(default, deserialize_with = "crate::serde_util::double_option")]
    pub icon_url: Option<Option<String>>,
}

#[derive(Deserialize, IntoParams)]
pub struct DiscoverQuery {
    pub q: Option<String>,
}
