//! One WebSocket connection: READY, client ops, heartbeat and cleanup.
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::time::{sleep_until, Instant};

use crate::auth::session;
use crate::error::{AppError, AppResult};
use crate::id::Id;
use crate::state::AppState;
use crate::{dms, reads, servers, users, voice};

use super::events::{ClientFrame, Event};
use super::presence;

const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(90);

#[derive(Deserialize)]
pub struct GatewayQuery {
    token: String,
}

pub async fn upgrade(
    State(state): State<AppState>,
    Query(q): Query<GatewayQuery>,
    ws: WebSocketUpgrade,
) -> AppResult<Response> {
    let user = session::resolve(&state, &q.token)
        .await?
        .ok_or(AppError::Unauthorized)?;
    Ok(ws.on_upgrade(move |socket| run(state, user, socket)))
}

struct Session {
    state: AppState,
    user: Id,
    conn_key: String,
    tx: UnboundedSender<Arc<str>>,
}

impl Session {
    fn send(&self, event: Event) {
        if let Ok(s) = serde_json::to_string(&event) {
            let _ = self.tx.send(s.into());
        }
    }

    async fn ready(&self) -> AppResult<Vec<Id>> {
        let user = users::repo::get(&self.state, self.user).await?;
        let servers = servers::repo::list_for_user(&self.state, self.user).await?;
        let dms = dms::repo::list(&self.state, self.user).await?;
        let mut voice_states = vec![];
        let mut members = Vec::with_capacity(servers.len());
        for s in &servers {
            let member = crate::permissions::member(&self.state, s.id, self.user).await?;
            voice_states.extend(voice::for_server(&self.state, s.id, Some(&member)).await?);
            members.push(member);
        }
        for dm in &dms {
            voice_states.extend(voice::state::members(&self.state, dm.id).await?);
        }
        let ids: Vec<Id> = servers.iter().map(|s| s.id).collect();
        // Unread state: where the user has read to, and the newest message of every channel they can see.
        // Unread data is optional: a failure here must not block the connection.
        let read_states = optional(reads::repo::for_user(&self.state, self.user).await, "read states");
        let dm_unread = optional(
            reads::repo::dm_unread_counts(&self.state, self.user).await,
            "dm unread counts",
        );
        // Presence of DM contacts; server members' presence comes with the member lists.
        let mut contacts: Vec<Id> = dms.iter().flat_map(|dm| dm.recipients.iter().map(|u| u.id)).collect();
        contacts.sort();
        contacts.dedup();
        contacts.retain(|id| *id != self.user);
        let contact_presence = optional(
            presence::presence_many(&self.state, &self.state.db.reader, &contacts).await,
            "dm presence",
        );
        let dm_presence: serde_json::Map<String, serde_json::Value> = contacts
            .iter()
            .zip(contact_presence)
            .map(|(id, p)| (id.to_string(), json!(p)))
            .collect();
        let presence_settings = presence::settings(&self.state, self.user).await?;
        let channel_heads: Vec<_> = optional(reads::repo::server_heads(&self.state, &ids).await, "channel heads")
            .into_iter()
            .filter(|h| {
                members
                    .iter()
                    .find(|m| Some(m.ctx.server_id) == h.server_id)
                    .is_some_and(|m| m.channel(h.channel_id) & crate::permissions::bits::VIEW_CHANNEL != 0)
            })
            .collect();
        self.send(Event::new(
            "READY",
            json!({
                "user": user,
                "servers": servers,
                "dms": dms,
                "voice_states": voice_states,
                "read_states": read_states,
                "channel_heads": channel_heads,
                "dm_unread": dm_unread,
                "dm_presence": dm_presence,
                "presence_settings": presence_settings,
            }),
        ));
        Ok(ids)
    }

    async fn handle(&self, text: &str) -> AppResult<()> {
        let frame: ClientFrame = serde_json::from_str(text).map_err(|e| AppError::bad(e.to_string()))?;
        match frame.op.as_str() {
            "HEARTBEAT" => {
                presence::touch(&self.state, self.user, &self.conn_key).await?;
                voice::state::refresh(&self.state, self.user, &self.conn_key).await?;
                self.send(Event::new("HEARTBEAT_ACK", json!({})));
            }
            "VOICE_JOIN" => voice::join(&self.state, self.user, &self.conn_key, frame.d).await?,
            "VOICE_LEAVE" => voice::leave(&self.state, self.user, Some(&self.conn_key)).await?,
            "VOICE_UPDATE" => voice::update(&self.state, self.user, &self.conn_key, frame.d).await?,
            "VOICE_SIGNAL" => voice::signal(&self.state, self.user, frame.d).await?,
            // Sent by the client after a stretch without input, and again when input resumes.
            "ACTIVITY" => {
                let idle = frame.d.get("idle").and_then(|v| v.as_bool()).unwrap_or(false);
                let before = presence::presence_of(&self.state, self.user).await?;
                presence::set_idle(&self.state, self.user, &self.conn_key, idle).await?;
                presence::broadcast_if_changed(&self.state, self.user, &before).await;
            }
            other => return Err(AppError::bad(format!("unknown op {other}"))),
        }
        Ok(())
    }
}

async fn run(state: AppState, user: Id, socket: WebSocket) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = unbounded_channel::<Arc<str>>();
    let session = Session {
        conn_key: state.ids.next().to_string(),
        state: state.clone(),
        user,
        tx: tx.clone(),
    };

    // Register before READY so no event published in between is missed.
    let server_ids = servers::repo::ids_for_user(&state, user).await.unwrap_or_default();
    let conn = state
        .hub
        .register(user, server_ids.iter().copied().collect::<HashSet<_>>(), tx);
    metrics::counter!("glacier_gateway_connections_total").increment(1);
    if let Err(e) = session.ready().await {
        tracing::warn!(error = %e, "READY failed");
        state.hub.unregister(conn);
        return;
    }
    let before = presence::presence_of(&state, user)
        .await
        .unwrap_or(presence::Presence::OFFLINE);
    if let Err(e) = presence::touch(&state, user, &session.conn_key).await {
        tracing::warn!(error = %e, "presence: could not register socket");
    }
    presence::broadcast_if_changed(&state, user, &before).await;

    let mut deadline = Instant::now() + HEARTBEAT_TIMEOUT;
    loop {
        tokio::select! {
            incoming = stream.next() => match incoming {
                Some(Ok(Message::Text(text))) => {
                    deadline = Instant::now() + HEARTBEAT_TIMEOUT;
                    if let Err(e) = session.handle(&text).await {
                        // `op` lets the client undo optimistic work (e.g. a rejected voice join).
                        let op = serde_json::from_str::<ClientFrame>(&text).map(|f| f.op).unwrap_or_default();
                        session.send(Event::new("ERROR", json!({ "message": e.to_string(), "op": op })));
                    }
                }
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                Some(Ok(_)) => deadline = Instant::now() + HEARTBEAT_TIMEOUT,
            },
            Some(frame) = rx.recv() => {
                if sink.send(Message::Text(frame.as_ref().into())).await.is_err() {
                    break;
                }
            }
            _ = sleep_until(deadline) => break,
        }
    }

    state.hub.unregister(conn);
    if let Err(e) = voice::leave(&state, user, Some(&session.conn_key)).await {
        tracing::warn!(error = %e, "voice cleanup failed");
    }
    let before = presence::presence_of(&state, user)
        .await
        .unwrap_or(presence::Presence::OFFLINE);
    if let Err(e) = presence::disconnect(&state, user, &session.conn_key).await {
        tracing::warn!(error = %e, "presence: could not remove socket");
    }
    presence::broadcast_if_changed(&state, user, &before).await;
}

fn optional<T>(result: AppResult<Vec<T>>, what: &str) -> Vec<T> {
    result.unwrap_or_else(|e| {
        tracing::warn!(error = %e, "READY: could not load {what}");
        vec![]
    })
}
