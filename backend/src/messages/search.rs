//! Message search across the channels a member can see (or one DM).
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use sqlx::{MySql, QueryBuilder};
use utoipa::{IntoParams, ToSchema};

use crate::auth::AuthUser;
use crate::channels::{self, ChannelType};
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::permissions::{self, bits};
use crate::state::AppState;

use super::models::{Message, MessageRow};
use super::repo;

const PAGE: u32 = 25;

#[derive(Deserialize, IntoParams)]
pub struct SearchQuery {
    /// Words to find; may be empty when filtering only.
    #[serde(default)]
    pub q: String,
    /// Only messages by this user.
    pub author_id: Option<Id>,
    /// Only this channel (server search).
    pub channel_id: Option<Id>,
    /// `link`, `file` or `image`.
    pub has: Option<String>,
    /// Older than this message id (pagination).
    pub before: Option<Id>,
}

#[derive(Serialize, ToSchema)]
pub struct SearchResults {
    /// Newest first.
    pub messages: Vec<Message>,
    pub has_more: bool,
}

/// InnoDB full-text ignores words under 3 characters, so short terms fall back to LIKE.
fn push_text_filter(qb: &mut QueryBuilder<'_, MySql>, q: &str) {
    let words: Vec<String> = q
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(str::to_lowercase)
        .collect();
    if words.is_empty() {
        return;
    }
    if words.iter().all(|w| w.chars().count() >= 3) {
        let boolean: String = words.iter().map(|w| format!("+{w}* ")).collect();
        qb.push(" AND MATCH(m.content) AGAINST (")
            .push_bind(boolean)
            .push(" IN BOOLEAN MODE)");
    } else {
        for w in words {
            let escaped = w.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
            qb.push(" AND m.content LIKE ").push_bind(format!("%{escaped}%"));
        }
    }
}

async fn run(state: &AppState, channel_ids: &[Id], p: &SearchQuery) -> AppResult<SearchResults> {
    if channel_ids.is_empty() {
        return Ok(SearchResults {
            messages: vec![],
            has_more: false,
        });
    }
    let mut qb: QueryBuilder<MySql> =
        QueryBuilder::new("SELECT m.id, m.channel_id, m.author_id, m.content, m.edited_at, m.created_at FROM messages m WHERE m.channel_id IN (");
    let mut sep = qb.separated(", ");
    for id in channel_ids {
        sep.push_bind(*id);
    }
    qb.push(")");
    push_text_filter(&mut qb, &p.q);
    if let Some(author) = p.author_id {
        qb.push(" AND m.author_id = ").push_bind(author);
    }
    if let Some(before) = p.before {
        qb.push(" AND m.id < ").push_bind(before);
    }
    match p.has.as_deref() {
        None | Some("") => {}
        Some("link") => {
            qb.push(" AND (m.content LIKE '%http://%' OR m.content LIKE '%https://%')");
        }
        Some("file") => {
            qb.push(" AND EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id)");
        }
        Some("image") => {
            qb.push(
                " AND EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id AND a.content_type LIKE 'image/%')",
            );
        }
        Some(_) => return Err(AppError::bad("has: must be link, file or image")),
    }
    qb.push(" ORDER BY m.id DESC LIMIT ").push_bind(PAGE + 1);
    let mut rows: Vec<MessageRow> = qb.build_query_as().fetch_all(&state.db.reader).await?;
    let has_more = rows.len() > PAGE as usize;
    rows.truncate(PAGE as usize);
    let mut messages = repo::hydrate(state, &state.db.reader, rows).await?;
    messages.sort_by_key(|m| std::cmp::Reverse(m.id));
    Ok(SearchResults { messages, has_more })
}

#[utoipa::path(get, path = "/api/servers/{id}/messages/search", tag = "messages", params(("id" = Id, Path), SearchQuery),
    responses((status = 200, body = SearchResults)))]
pub async fn in_server(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Query(p): Query<SearchQuery>,
) -> AppResult<Json<SearchResults>> {
    let member = permissions::member(&state, id, auth.id).await?;
    let visible: Vec<Id> = channels::repo::list_for_server(&state, id)
        .await?
        .into_iter()
        .filter(|c| c.kind == ChannelType::Text && member.channel(c.id) & bits::VIEW_CHANNEL != 0)
        .map(|c| c.id)
        .filter(|cid| p.channel_id.is_none_or(|want| want == *cid))
        .collect();
    Ok(Json(run(&state, &visible, &p).await?))
}

#[utoipa::path(get, path = "/api/channels/{id}/messages/search", tag = "messages", params(("id" = Id, Path), SearchQuery),
    responses((status = 200, body = SearchResults)))]
pub async fn in_channel(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
    Query(p): Query<SearchQuery>,
) -> AppResult<Json<SearchResults>> {
    let access = channels::access(&state, id, auth.id).await?;
    access.require_text()?;
    Ok(Json(run(&state, &[id], &p).await?))
}
