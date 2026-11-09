//! Redis pub/sub bus: every replica publishes events to one channel and
//! every replica delivers the ones that match its local connections.
use futures_util::StreamExt;
use redis::AsyncCommands;

use crate::id::Id;
use crate::permissions;
use crate::state::AppState;

use super::events::{Envelope, Event, Target};

pub const CHANNEL: &str = "glacier:events";

/// Publish an event. Failures are logged; realtime delivery is best-effort.
pub async fn publish(state: &AppState, target: Target, event: Event) {
    let target = match resolve(state, target).await {
        Ok(t) => t,
        Err(e) => {
            tracing::warn!(error = %e, "could not resolve event target");
            return;
        }
    };
    let Ok(payload) = serde_json::to_string(&Envelope { target, event }) else {
        return;
    };
    let result: redis::RedisResult<()> = state.redis().publish(CHANNEL, payload).await;
    match result {
        Ok(()) => metrics::counter!("glacier_events_published_total").increment(1),
        Err(e) => tracing::warn!(error = %e, "publish failed"),
    }
}

async fn resolve(state: &AppState, target: Target) -> crate::error::AppResult<Target> {
    match target {
        Target::Channel {
            server: Some(server),
            channel,
        } => Ok(match permissions::channel_audience(state, server, channel).await? {
            None => Target::Server(server),
            Some(users) => Target::Users(users),
        }),
        Target::Channel { server: None, channel } => {
            let rows: Vec<(Id,)> = sqlx::query_as("SELECT user_id FROM dm_participants WHERE channel_id = ?")
                .bind(channel)
                .fetch_all(&state.db.writer)
                .await?;
            Ok(Target::Users(rows.into_iter().map(|(u,)| u).collect()))
        }
        other => Ok(other),
    }
}

/// Subscribe to the bus forever, reconnecting on failure.
pub fn start_bridge(state: AppState) {
    tokio::spawn(async move {
        loop {
            if let Err(e) = run(&state).await {
                tracing::error!(error = %e, "pub/sub bridge failed; reconnecting");
            }
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    });
}

async fn run(state: &AppState) -> redis::RedisResult<()> {
    let mut pubsub = state.redis_client.get_async_pubsub().await?;
    pubsub.subscribe(CHANNEL).await?;
    tracing::info!("subscribed to {CHANNEL}");
    let mut stream = pubsub.on_message();
    while let Some(msg) = stream.next().await {
        let payload: String = msg.get_payload()?;
        metrics::counter!("glacier_events_received_total").increment(1);
        match serde_json::from_str::<Envelope>(&payload) {
            Ok(env) => state.hub.dispatch(&env),
            Err(e) => tracing::warn!(error = %e, "bad envelope"),
        }
    }
    Ok(())
}
