use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::id::Id;
use crate::servers::Server;
use crate::users::User;

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct InviteRow {
    pub code: String,
    pub server_id: Id,
    pub inviter_id: Id,
    pub max_uses: Option<u32>,
    pub uses: u32,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl InviteRow {
    pub fn is_usable(&self) -> bool {
        self.expires_at.is_none_or(|e| e > Utc::now()) && self.max_uses.is_none_or(|m| self.uses < m)
    }
}

#[derive(Serialize, ToSchema)]
pub struct Invite {
    pub code: String,
    pub server: Server,
    pub inviter_id: Id,
    /// Who created it; null if that account no longer exists.
    pub inviter: Option<User>,
    pub max_uses: Option<u32>,
    pub uses: u32,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl Invite {
    pub fn new(row: InviteRow, server: Server, inviter: Option<User>) -> Self {
        Self {
            code: row.code,
            server,
            inviter_id: row.inviter_id,
            inviter,
            max_uses: row.max_uses,
            uses: row.uses,
            expires_at: row.expires_at,
            created_at: row.created_at,
        }
    }
}

#[derive(Deserialize, ToSchema, Default)]
pub struct CreateInvite {
    pub max_uses: Option<u32>,
    pub expires_in_secs: Option<u64>,
}
