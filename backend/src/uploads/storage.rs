use aws_sdk_s3::primitives::ByteStream;
use axum::body::Bytes;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Uploads to MinIO/S3 and returns the public URL (served by nginx under /files).
pub async fn put(state: &AppState, key: &str, content_type: &str, data: Bytes) -> AppResult<String> {
    state
        .s3
        .put_object()
        .bucket(&state.bucket)
        .key(key)
        .content_type(content_type)
        .body(ByteStream::from(data))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("s3 put: {e}")))?;
    Ok(format!("{}/{key}", state.files_prefix))
}

/// Keeps a safe, readable file name for object keys and downloads.
pub fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("")
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .take(100)
        .collect();
    let trimmed = cleaned.trim_matches('.');
    if trimmed.is_empty() {
        "file".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_filename;

    #[test]
    fn strips_paths_and_odd_chars() {
        assert_eq!(sanitize_filename("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_filename("my photo (1).png"), "my_photo__1_.png");
        assert_eq!(sanitize_filename("..."), "file");
    }
}
