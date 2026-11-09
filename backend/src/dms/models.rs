use serde::Deserialize;
use utoipa::ToSchema;

use crate::id::Id;

#[derive(Deserialize, ToSchema)]
pub struct CreateDm {
    /// Other participants. One id opens (or reuses) a 1:1 DM; more creates a group.
    pub user_ids: Vec<Id>,
    pub name: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct RenameDm {
    pub name: String,
}
