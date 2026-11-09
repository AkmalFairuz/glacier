use axum::body::Bytes;
use axum::extract::{Multipart, Path, State};
use axum::Json;
use chrono::Utc;
use serde::Serialize;
use utoipa::ToSchema;

use crate::auth::AuthUser;
use crate::channels;
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::messages::Attachment;
use crate::permissions::bits;
use crate::state::AppState;

use super::storage;

pub const MAX_ATTACHMENT: usize = 25 * 1024 * 1024;
const MAX_IMAGE: usize = 8 * 1024 * 1024;

/// multipart/form-data with a single `file` field.
/// Only describes the request body for OpenAPI; the handlers read the multipart stream directly.
#[derive(ToSchema)]
#[allow(dead_code)]
pub struct UploadForm {
    #[schema(value_type = String, format = Binary)]
    file: Vec<u8>,
}

#[derive(Serialize, ToSchema)]
pub struct UploadedImage {
    pub url: String,
}

struct FilePart {
    filename: String,
    content_type: String,
    data: Bytes,
}

async fn read_file(mut multipart: Multipart, max: usize) -> AppResult<FilePart> {
    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::bad(e.to_string()))? {
        if field.name() != Some("file") {
            continue;
        }
        let filename = storage::sanitize_filename(field.file_name().unwrap_or("file"));
        let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
        let data = field.bytes().await.map_err(|_| AppError::PayloadTooLarge)?;
        if data.len() > max {
            return Err(AppError::PayloadTooLarge);
        }
        if data.is_empty() {
            return Err(AppError::bad("file is empty"));
        }
        return Ok(FilePart {
            filename,
            content_type,
            data,
        });
    }
    Err(AppError::bad("missing `file` field"))
}

#[utoipa::path(post, path = "/api/channels/{id}/attachments", tag = "uploads", params(("id" = Id, Path)),
    request_body(content = UploadForm, content_type = "multipart/form-data"),
    responses((status = 200, body = Attachment), (status = 413)))]
pub async fn attachment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    multipart: Multipart,
) -> AppResult<Json<Attachment>> {
    let access = channels::access(&state, id, auth.id).await?;
    access.require_text()?;
    access.require(bits::ATTACH_FILES)?;
    let file = read_file(multipart, MAX_ATTACHMENT).await?;
    let (width, height) = match imagesize::blob_size(&file.data) {
        Ok(size) if file.content_type.starts_with("image/") => (Some(size.width as u32), Some(size.height as u32)),
        _ => (None, None),
    };
    let att_id = state.ids.next();
    let key = format!("attachments/{id}/{att_id}/{}", file.filename);
    let size = file.data.len() as u64;
    let url = storage::put(&state, &key, &file.content_type, file.data).await?;
    sqlx::query(
        "INSERT INTO attachments (id, channel_id, uploader_id, url, filename, content_type, size, width, height, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(att_id)
    .bind(id)
    .bind(auth.id)
    .bind(&url)
    .bind(&file.filename)
    .bind(&file.content_type)
    .bind(size)
    .bind(width)
    .bind(height)
    .bind(Utc::now())
    .execute(&state.db.writer)
    .await?;
    Ok(Json(Attachment {
        id: att_id,
        url,
        filename: file.filename,
        content_type: file.content_type,
        size,
        width,
        height,
    }))
}

#[utoipa::path(post, path = "/api/uploads/image", tag = "uploads",
    request_body(content = UploadForm, content_type = "multipart/form-data"),
    responses((status = 200, body = UploadedImage)))]
pub async fn image(
    State(state): State<AppState>,
    _auth: AuthUser,
    multipart: Multipart,
) -> AppResult<Json<UploadedImage>> {
    let file = read_file(multipart, MAX_IMAGE).await?;
    let ext = match file.content_type.as_str() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => return Err(AppError::bad("image must be png, jpeg, gif or webp")),
    };
    if imagesize::blob_size(&file.data).is_err() {
        return Err(AppError::bad("not a valid image"));
    }
    let key = format!("images/{}.{ext}", state.ids.next());
    let url = storage::put(&state, &key, &file.content_type, file.data).await?;
    Ok(Json(UploadedImage { url }))
}
