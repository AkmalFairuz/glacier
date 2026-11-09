//! Voice REST endpoint plus the gateway ops (join/leave/update/signal).
use axum::extract::{Path, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::AuthUser;
use crate::channels::{self, ChannelType};
use crate::error::{AppError, AppResult};
use crate::gateway::{self, Event, Target};
use crate::id::Id;
use crate::permissions::{self, bits};
use crate::state::AppState;
use crate::users;

use super::state::{self as voice, VoiceState};

#[utoipa::path(get, path = "/api/servers/{id}/voice-states", tag = "voice", params(("id" = Id, Path)), responses((status = 200, body = Vec<VoiceState>)))]
pub async fn server_states(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Id>,
) -> AppResult<Json<Vec<VoiceState>>> {
    let member = permissions::member(&state, id, auth.id).await?;
    Ok(Json(for_server(&state, id, Some(&member)).await?))
}

pub async fn for_server(
    state: &AppState,
    server: Id,
    viewer: Option<&permissions::Member>,
) -> AppResult<Vec<VoiceState>> {
    let mut out = vec![];
    for channel in channels::repo::voice_channel_ids(state, server).await? {
        if viewer.is_some_and(|m| m.channel(channel) & bits::VIEW_CHANNEL == 0) {
            continue;
        }
        out.extend(voice::members(state, channel).await?);
    }
    Ok(out)
}

fn target(v: &VoiceState) -> Target {
    Target::Channel {
        server: v.server_id,
        channel: v.channel_id,
    }
}

async fn announce_leave(state: &AppState, left: VoiceState) {
    let d = json!({ "user_id": left.user_id, "channel_id": left.channel_id });
    gateway::publish(state, target(&left), Event::new("VOICE_STATE_DELETE", d)).await;
}

pub async fn leave(state: &AppState, user: Id, conn: Option<&str>) -> AppResult<()> {
    if let Some(left) = voice::leave(state, user, conn).await? {
        announce_leave(state, left).await;
    }
    Ok(())
}

#[derive(Deserialize)]
struct JoinOp {
    channel_id: Id,
}

pub async fn join(state: &AppState, user: Id, conn: &str, d: Value) -> AppResult<()> {
    let JoinOp { channel_id } = serde_json::from_value(d).map_err(|e| AppError::bad(e.to_string()))?;
    let access = channels::access(state, channel_id, user).await?;
    if !matches!(
        access.channel.kind,
        ChannelType::Voice | ChannelType::Dm | ChannelType::GroupDm
    ) {
        return Err(AppError::bad("not a voice-capable channel"));
    }
    access.require(bits::CONNECT)?;
    if let Some(limit) = access.channel.user_limit {
        let room = voice::members(state, channel_id).await?;
        let others = room.iter().filter(|v| v.user_id != user).count();
        if others >= usize::from(limit) && !access.has(bits::MANAGE_CHANNELS) {
            return Err(AppError::bad("this voice channel is full"));
        }
    }
    // Rejoining the same room (e.g. after a reconnect) just moves ownership
    // to this socket; announcing a leave would tear down the client's call.
    if voice::current(state, user)
        .await?
        .is_some_and(|v| v.channel_id != channel_id)
    {
        leave(state, user, None).await?;
    }

    let was_empty = voice::members(state, channel_id).await?.is_empty();
    let vs = VoiceState {
        user_id: user,
        channel_id,
        server_id: access.channel.server_id,
        muted: !access.has(bits::SPEAK),
        deafened: false,
        video: false,
        screen: false,
    };
    voice::join(state, vs.clone(), conn).await?;
    gateway::publish(state, target(&vs), Event::new("VOICE_STATE_UPDATE", &vs)).await;

    if access.channel.kind.is_dm() && was_empty {
        let caller = users::repo::get(state, user).await?;
        let others: Vec<Id> = crate::dms::repo::participants(state, channel_id)
            .await?
            .into_iter()
            .filter(|u| *u != user)
            .collect();
        gateway::publish(
            state,
            Target::Users(others),
            Event::new("CALL_RING", json!({ "channel_id": channel_id, "caller": caller })),
        )
        .await;
    }
    Ok(())
}

#[derive(Deserialize)]
struct UpdateOp {
    muted: Option<bool>,
    deafened: Option<bool>,
    video: Option<bool>,
    screen: Option<bool>,
}

pub async fn update(state: &AppState, user: Id, conn: &str, d: Value) -> AppResult<()> {
    let op: UpdateOp = serde_json::from_value(d).map_err(|e| AppError::bad(e.to_string()))?;
    let Some(current) = voice::current(state, user).await? else {
        return Ok(());
    };
    let access = channels::access(state, current.channel_id, user).await?;
    let updated = voice::update_flags(state, user, conn, |v| {
        if let Some(m) = op.muted {
            v.muted = m || !access.has(bits::SPEAK);
        }
        if let Some(d) = op.deafened {
            v.deafened = d;
        }
        if let Some(on) = op.video {
            v.video = on && access.has(bits::VIDEO);
        }
        if let Some(on) = op.screen {
            v.screen = on && access.has(bits::VIDEO);
        }
    })
    .await?;
    if let Some(vs) = updated {
        gateway::publish(state, target(&vs), Event::new("VOICE_STATE_UPDATE", &vs)).await;
    }
    Ok(())
}

#[derive(Deserialize)]
struct SignalOp {
    to_user_id: Id,
    data: Value,
}

/// Relays WebRTC SDP/ICE between two members of the same room.
pub async fn signal(state: &AppState, user: Id, d: Value) -> AppResult<()> {
    let op: SignalOp = serde_json::from_value(d).map_err(|e| AppError::bad(e.to_string()))?;
    let from = voice::current(state, user)
        .await?
        .ok_or(AppError::bad("not in a voice room"))?;
    let to = voice::current(state, op.to_user_id).await?;
    if to.is_none_or(|t| t.channel_id != from.channel_id) {
        return Err(AppError::bad("peer is not in your voice room"));
    }
    let d = json!({ "from_user_id": user, "channel_id": from.channel_id, "data": op.data });
    gateway::publish(state, Target::User(op.to_user_id), Event::new("VOICE_SIGNAL", d)).await;
    Ok(())
}
