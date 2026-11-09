//! OpenAPI document generated from handler annotations.
//! Export as split YAML with `cargo run -- openapi` (writes ../openapi/ by default).
mod export;

pub use export::write;

use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};

use crate::{auth, channels, dms, error, id, invites, members, messages, reads, roles, servers, uploads, users, voice};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Glacier API",
        version = "0.1.0",
        description = "REST API for Glacier. Realtime events are delivered over the WebSocket gateway at `/gateway?token=<token>` (not described here)."
    ),
    paths(
        auth::handlers::register, auth::handlers::login, auth::handlers::logout,
        auth::handlers::change_password, auth::handlers::revoke_other_sessions,
        users::handlers::me, users::handlers::update_me, users::handlers::search, users::handlers::ice_config,
        users::handlers::profile, users::handlers::set_note,
        servers::handlers::list, servers::handlers::create, servers::handlers::discover, servers::handlers::get,
        servers::handlers::update, servers::handlers::delete, servers::handlers::join, servers::handlers::my_permissions,
        members::handlers::list, members::handlers::update, members::handlers::remove,
        members::handlers::bans, members::handlers::ban, members::handlers::unban,
        roles::handlers::list, roles::handlers::create, roles::handlers::update, roles::handlers::delete,
        channels::handlers::list, channels::handlers::create, channels::handlers::reorder, channels::handlers::update, channels::handlers::delete,
        channels::handlers::put_overwrite, channels::handlers::delete_overwrite,
        messages::handlers::list, messages::handlers::create, messages::handlers::edit, messages::handlers::delete,
        messages::handlers::typing, messages::reactions::add, messages::reactions::remove,
        messages::search::in_server, messages::search::in_channel,
        uploads::handlers::attachment, uploads::handlers::image,
        invites::handlers::create, invites::handlers::list, invites::handlers::preview, invites::handlers::accept, invites::handlers::delete,
        dms::handlers::list, dms::handlers::create, dms::handlers::rename, dms::handlers::add_recipient, dms::handlers::leave,
        voice::handlers::server_states,
        reads::handlers::ack, reads::handlers::receipts,
    ),
    components(schemas(id::Id, error::ErrorBody, error::ErrorDetail, voice::VoiceState, messages::models::Reaction)),
    modifiers(&BearerAuth, &ResponseFieldsRequired, &UniqueOperationIds),
    security(("bearer" = [])),
    tags(
        (name = "auth"), (name = "users"), (name = "servers"), (name = "members"), (name = "roles"),
        (name = "channels"), (name = "messages"), (name = "uploads"), (name = "invites"), (name = "dms"), (name = "voice"),
    )
)]
struct ApiDoc;

struct BearerAuth;

impl Modify for BearerAuth {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "bearer",
            SecurityScheme::Http(HttpBuilder::new().scheme(HttpAuthScheme::Bearer).build()),
        );
    }
}

/// Response bodies always serialize every field (absent values are `null`),
/// so mark all their properties required for accurate generated types.
struct ResponseFieldsRequired;

const RESPONSE_SCHEMAS: &[&str] = &[
    "User",
    "Server",
    "Channel",
    "Overwrite",
    "Role",
    "Member",
    "Attachment",
    "Reaction",
    "Message",
    "Invite",
    "Ban",
    "VoiceState",
    "Permissions",
    "AuthResponse",
    "ErrorBody",
    "ErrorDetail",
    "IceConfig",
    "IceServer",
    "UploadedImage",
    "RevokedSessions",
    "UserProfile",
    "SearchResults",
    "ReadReceipt",
];

impl Modify for ResponseFieldsRequired {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        use utoipa::openapi::{RefOr, Schema};
        let Some(components) = openapi.components.as_mut() else {
            return;
        };
        for name in RESPONSE_SCHEMAS {
            if let Some(RefOr::T(Schema::Object(object))) = components.schemas.get_mut(*name) {
                object.required = object.properties.keys().cloned().collect();
            }
        }
    }
}

/// Handler names repeat across modules (`list`, `create`, ...), so prefix
/// each operation id with its tag to keep them unique.
struct UniqueOperationIds;

impl Modify for UniqueOperationIds {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        for item in openapi.paths.paths.values_mut() {
            let operations = [
                &mut item.get,
                &mut item.post,
                &mut item.put,
                &mut item.patch,
                &mut item.delete,
            ];
            for op in operations.into_iter().flatten() {
                let tag = op.tags.as_ref().and_then(|t| t.first()).cloned().unwrap_or_default();
                if let Some(id) = op.operation_id.as_mut() {
                    *id = format!("{tag}_{id}");
                }
            }
        }
    }
}

pub fn spec() -> utoipa::openapi::OpenApi {
    ApiDoc::openapi()
}

#[cfg(test)]
mod tests {
    #[test]
    fn spec_builds() {
        let spec = super::spec();
        assert!(spec.paths.paths.contains_key("/api/servers/{id}/channels"));
        let mut ids: Vec<String> = spec
            .paths
            .paths
            .values()
            .flat_map(|p| [&p.get, &p.post, &p.put, &p.patch, &p.delete])
            .flatten()
            .filter_map(|op| op.operation_id.clone())
            .collect();
        let total = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), total, "operation ids must be unique");
        let schemas = spec.components.expect("components").schemas;
        for name in super::RESPONSE_SCHEMAS {
            assert!(schemas.contains_key(*name), "missing schema {name}");
        }
    }
}
