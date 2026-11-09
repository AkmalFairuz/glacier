mod auth;
mod cache;
mod channels;
mod config;
mod db;
mod dms;
mod embeds;
mod error;
mod gateway;
mod id;
mod invites;
mod members;
mod messages;
mod metrics;
mod openapi;
mod permissions;
mod ratelimit;
mod reads;
mod roles;
mod routes;
mod serde_util;
mod servers;
mod state;
mod uploads;
mod users;
mod voice;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    config::init_tracing();
    if std::env::args().nth(1).as_deref() == Some("openapi") {
        let dir = std::env::args().nth(2).unwrap_or_else(|| "../openapi".into());
        openapi::write(std::path::Path::new(&dir))?;
        return Ok(());
    }

    let config = config::Config::from_env();
    let state = state::AppState::build(&config).await?;
    state.db.migrate().await?;
    gateway::start_bridge(state.clone());

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    tracing::info!(addr = %config.bind_addr, worker = state.ids.worker_id(), "glacier listening");
    axum::serve(listener, routes::router(state)).await?;
    Ok(())
}
