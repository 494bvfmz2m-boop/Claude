mod auth;
mod error;
mod handlers;
mod models;
mod ratelimit;
mod state;

use axum::routing::{get, post};
use axum::Router;
use ratelimit::RateLimiter;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use state::AppState;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let db_path = std::env::var("VAULT_DB_PATH").unwrap_or_else(|_| "vault.db".to_string());
    let bind_addr = std::env::var("VAULT_BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:7878".to_string());

    let opts = SqliteConnectOptions::from_str(&format!("sqlite://{db_path}"))?.create_if_missing(true);
    let pool = SqlitePoolOptions::new().max_connections(5).connect_with(opts).await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    let limiter = Arc::new(RateLimiter::new(5, Duration::from_secs(300)));
    let state = AppState { db: pool, limiter };

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/register", post(handlers::register))
        .route("/users/:username/salt", get(handlers::get_salt))
        .route("/login", post(handlers::login))
        .route("/logout", post(handlers::logout))
        .route("/items", get(handlers::list_items).post(handlers::create_item))
        .route(
            "/items/:id",
            get(handlers::get_item).put(handlers::update_item).delete(handlers::delete_item),
        )
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    if !bind_addr.starts_with("127.0.0.1") && !bind_addr.starts_with("localhost") {
        tracing::warn!(
            "binding to {bind_addr}: this server speaks plain HTTP. \
             Put it behind TLS (a reverse proxy like Caddy/nginx, or a VPN/SSH tunnel) \
             before exposing it beyond localhost — auth keys and encrypted blobs would \
             otherwise cross the network unprotected from tampering/replay by a network observer."
        );
    }

    tracing::info!("vault-server listening on {bind_addr}");
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
