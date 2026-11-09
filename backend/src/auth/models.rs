use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::id::Id;
use crate::users::User;

#[derive(Deserialize, ToSchema)]
pub struct RegisterBody {
    pub username: String,
    pub password: String,
    pub display_name: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct LoginBody {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, ToSchema)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

#[derive(sqlx::FromRow)]
pub struct Credentials {
    pub id: Id,
    pub password_hash: String,
}

#[derive(Deserialize, ToSchema)]
pub struct ChangePasswordBody {
    pub current_password: String,
    pub new_password: String,
}
