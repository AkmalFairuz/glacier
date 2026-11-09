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

use super::events::{ClientFrame, Event, Target};
use super::{presence, publish};

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
        let online = optional(presence::online_many(&self.state, &contacts).await, "dm presence");
        let dm_presence: serde_json::Map<String, serde_json::Value> = contacts
            .iter()
            .zip(online)
            .map(|(id, on)| (id.to_string(), on.into()))
            .collect();
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
            other => return Err(AppError::bad(format!("unknown op {other}"))),
        }
        Ok(())
    }

    /// Tells everyone who can see this user: members of shared servers and DM contacts.
    async fn set_presence(&self, servers: Vec<Id>, online: bool) {
        let event = Event::new("PRESENCE_UPDATE", json!({ "user_id": self.user, "online": online }));
        publish(&self.state, Target::Servers(servers), event.clone()).await;
        match dms::repo::contacts(&self.state, self.user).await {
            Ok(contacts) if !contacts.is_empty() => publish(&self.state, Target::Users(contacts), event).await,
            Ok(_) => {}
            Err(e) => tracing::warn!(error = %e, "presence: could not load DM contacts"),
        }
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
    let server_ids = match session.ready().await {
        Ok(ids) => ids,
        Err(e) => {
            tracing::warn!(error = %e, "READY failed");
            state.hub.unregister(conn);
            return;
        }
    };
    if presence::connect(&state, user, &session.conn_key)
        .await
        .unwrap_or(false)
    {
        session.set_presence(server_ids, true).await;
    }

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
    if presence::disconnect(&state, user, &session.conn_key)
        .await
        .unwrap_or(false)
    {
        let ids = servers::repo::ids_for_user(&state, user).await.unwrap_or_default();
        session.set_presence(ids, false).await;
    }
}

fn optional<T>(result: AppResult<Vec<T>>, what: &str) -> Vec<T> {
    result.unwrap_or_else(|e| {
        tracing::warn!(error = %e, "READY: could not load {what}");
        vec![]
    })
}
