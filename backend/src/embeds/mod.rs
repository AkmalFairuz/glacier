//! Link previews (Open Graph cards) under messages.
//!
//! After a message is sent or edited, a background task fetches up to three links, stores the
//! cards in `message_embeds` and publishes `MESSAGE_UPDATE`. Results are cached in Redis per URL,
//! and preview images are copied to MinIO so clients only ever load them from `/files`.
pub mod fetch;

use std::collections::HashMap;

use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use redis::AsyncCommands;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::MySqlPool;
use utoipa::ToSchema;

use crate::auth::AuthUser;
use crate::channels;
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::messages;
use crate::permissions::bits;
use crate::state::AppState;

const MAX_LINKS: usize = 3;
const CACHE_HIT_SECS: u64 = 24 * 3600;
const CACHE_MISS_SECS: u64 = 3600;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct EmbedImage {
    /// Served by Glacier under /files, never the original host.
    pub url: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct Embed {
    /// The link the preview is for.
    pub url: String,
    pub site_name: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<EmbedImage>,
}

/// Links worth previewing: http(s) URLs outside code, at most three, without duplicates.
/// A link wrapped in angle brackets (`<https://...>`) is left without a preview.
pub fn links(content: &str) -> Vec<Url> {
    // Splitting on backticks puts code (inline or fenced) at the odd positions; keep the rest.
    let text = content.split('`').step_by(2).collect::<Vec<_>>().join(" ");
    let mut found: Vec<Url> = vec![];
    for word in text.split_whitespace() {
        if word.starts_with('<') {
            continue;
        }
        let word = word
            .trim_start_matches(|c: char| "(['\"".contains(c))
            .trim_end_matches(|c: char| ".,!?;:'\")]>".contains(c));
        if !(word.starts_with("http://") || word.starts_with("https://")) {
            continue;
        }
        let Ok(url) = Url::parse(word) else { continue };
        if !found.contains(&url) {
            found.push(url);
        }
        if found.len() == MAX_LINKS {
            break;
        }
    }
    found
}

fn cache_key(url: &Url) -> String {
    format!("glacier:embed:{}", hex::encode(Sha256::digest(url.as_str().as_bytes())))
}

/// Preview of one link, from the Redis cache when possible.
async fn preview(state: &AppState, url: &Url) -> Option<Embed> {
    let key = cache_key(url);
    let mut redis = state.redis();
    if let Ok(Some(cached)) = redis.get::<_, Option<String>>(&key).await {
        metrics::counter!("glacier_link_previews_total", "result" => "cached").increment(1);
        return serde_json::from_str::<Option<Embed>>(&cached).ok().flatten();
    }
    let embed = build(state, url).await;
    let result = if embed.is_some() { "ok" } else { "none" };
    metrics::counter!("glacier_link_previews_total", "result" => result).increment(1);
    let ttl = if embed.is_some() {
        CACHE_HIT_SECS
    } else {
        CACHE_MISS_SECS
    };
    if let Ok(json) = serde_json::to_string(&embed) {
        let _: Result<(), _> = redis.set_ex(&key, json, ttl).await;
    }
    embed
}

async fn build(state: &AppState, url: &Url) -> Option<Embed> {
    let page = fetch::fetch_page(url).await?;
    let image = match &page.image {
        Some(src) => copy_image(state, src).await,
        None => None,
    };
    Some(Embed {
        url: url.to_string(),
        site_name: page.site_name,
        title: page.title,
        description: page.description,
        image,
    })
}

/// Downloads the preview image and stores a copy in MinIO.
async fn copy_image(state: &AppState, src: &Url) -> Option<EmbedImage> {
    let (bytes, content_type) = fetch::fetch_image(src).await?;
    let size = imagesize::blob_size(&bytes).ok();
    let ext = content_type.trim_start_matches("image/");
    let key = format!("embeds/{}.{ext}", hex::encode(Sha256::digest(src.as_str().as_bytes())));
    let url = crate::uploads::storage::put(state, &key, content_type, Bytes::from(bytes))
        .await
        .ok()?;
    Some(EmbedImage {
        url,
        width: size.map(|s| s.width as u32),
        height: size.map(|s| s.height as u32),
    })
}

type EmbedRow = (
    Id,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<u32>,
    Option<u32>,
);

/// Stored previews of the given messages, in link order.
pub async fn for_messages(pool: &MySqlPool, ids: &[Id]) -> AppResult<HashMap<Id, Vec<Embed>>> {
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    let sql = format!(
        "SELECT message_id, url, site_name, title, description, image_url, image_width, image_height \
         FROM message_embeds WHERE message_id IN ({}) ORDER BY message_id, position",
        vec!["?"; ids.len()].join(",")
    );
    let mut q = sqlx::query_as::<_, EmbedRow>(&sql);
    for id in ids {
        q = q.bind(*id);
    }
    let mut out: HashMap<Id, Vec<Embed>> = HashMap::new();
    for (mid, url, site_name, title, description, image_url, width, height) in q.fetch_all(pool).await? {
        out.entry(mid).or_default().push(Embed {
            url,
            site_name,
            title,
            description,
            image: image_url.map(|url| EmbedImage { url, width, height }),
        });
    }
    Ok(out)
}

/// Replaces a message's previews. Returns false when nothing changed.
async fn replace(state: &AppState, message: Id, embeds: &[Embed]) -> AppResult<bool> {
    let current = for_messages(&state.db.writer, &[message])
        .await?
        .remove(&message)
        .unwrap_or_default();
    if current == embeds {
        return Ok(false);
    }
    let mut tx = state.db.writer.begin().await?;
    sqlx::query("DELETE FROM message_embeds WHERE message_id = ?")
        .bind(message)
        .execute(&mut *tx)
        .await?;
    for (position, e) in embeds.iter().enumerate() {
        sqlx::query(
            "INSERT INTO message_embeds (message_id, position, url, site_name, title, description, image_url, image_width, image_height) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(message)
        .bind(position as u8)
        .bind(&e.url)
        .bind(&e.site_name)
        .bind(&e.title)
        .bind(&e.description)
        .bind(e.image.as_ref().map(|i| &i.url))
        .bind(e.image.as_ref().and_then(|i| i.width))
        .bind(e.image.as_ref().and_then(|i| i.height))
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(true)
}

async fn suppressed(state: &AppState, message: Id) -> AppResult<bool> {
    let row: Option<(bool,)> = sqlx::query_as("SELECT suppress_embeds FROM messages WHERE id = ?")
        .bind(message)
        .fetch_optional(&state.db.writer)
        .await?;
    // A deleted message counts as suppressed: nothing to do.
    Ok(row.is_none_or(|(s,)| s))
}

/// Fetches previews for a message in the background and pushes the result to clients.
pub fn refresh(state: AppState, target: Target, channel: Id, message: Id, content: String) {
    tokio::spawn(async move {
        if let Err(e) = run(&state, target, channel, message, &content).await {
            tracing::warn!(error = %e, %message, "link previews failed");
        }
    });
}

async fn run(state: &AppState, target: Target, channel: Id, message: Id, content: &str) -> AppResult<()> {
    if suppressed(state, message).await? {
        return Ok(());
    }
    let urls = links(content);
    let fetched = futures_util::future::join_all(urls.iter().map(|u| preview(state, u))).await;
    let embeds: Vec<Embed> = fetched.into_iter().flatten().collect();
    // The message may have been deleted or suppressed while fetching.
    if suppressed(state, message).await? || !replace(state, message, &embeds).await? {
        return Ok(());
    }
    let updated = messages::repo::get(state, channel, message).await?;
    gateway::publish(state, target, Event::new("MESSAGE_UPDATE", &updated)).await;
    Ok(())
}

#[utoipa::path(delete, path = "/api/channels/{cid}/messages/{mid}/embeds", tag = "messages", operation_id = "remove_embeds",
    params(("cid" = Id, Path), ("mid" = Id, Path)), responses((status = 204)))]
/// Removes the link previews from a message for good (author or Manage Messages).
pub async fn remove(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((cid, mid)): Path<(Id, Id)>,
) -> AppResult<StatusCode> {
    let access = channels::access(&state, cid, auth.id).await?;
    if messages::repo::author_of(&state, cid, mid).await? != auth.id && !access.has(bits::MANAGE_MESSAGES) {
        return Err(AppError::Forbidden("missing permission"));
    }
    sqlx::query("UPDATE messages SET suppress_embeds = 1 WHERE id = ?")
        .bind(mid)
        .execute(&state.db.writer)
        .await?;
    replace(&state, mid, &[]).await?;
    let updated = messages::repo::get(&state, cid, mid).await?;
    gateway::publish(&state, access.target(), Event::new("MESSAGE_UPDATE", &updated)).await;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::links;

    fn strs(content: &str) -> Vec<String> {
        links(content).into_iter().map(|u| u.to_string()).collect()
    }

    #[test]
    fn finds_up_to_three_distinct_links() {
        assert_eq!(
            strs("see https://a.example/x, and (https://b.example/y). https://a.example/x https://c.example https://d.example"),
            vec!["https://a.example/x", "https://b.example/y", "https://c.example/"]
        );
    }

    #[test]
    fn skips_code_and_angle_brackets() {
        assert!(strs("`https://a.example` and ```\nhttps://b.example\n``` and <https://c.example>").is_empty());
        assert_eq!(
            strs("no preview <https://c.example> but https://d.example"),
            vec!["https://d.example/"]
        );
    }
}
