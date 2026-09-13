use crate::auth::{hash_token, AuthUser};
use crate::error::AppError;
use crate::models::{
    ItemDbRow, ItemRequest, ItemResponse, LoginRequest, LoginResponse, RegisterRequest, SaltResponse,
};
use crate::state::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::Utc;
use rand::RngCore;
use uuid::Uuid;

const SESSION_TTL_HOURS: i64 = 12;
const MAX_USERNAME_LEN: usize = 64;

pub async fn register(State(state): State<AppState>, Json(req): Json<RegisterRequest>) -> Result<StatusCode, AppError> {
    let username = req.username.trim();
    if username.is_empty() || username.len() > MAX_USERNAME_LEN {
        return Err(AppError::BadRequest("invalid username".into()));
    }

    let salt = vault_crypto::b64_decode(&req.salt).map_err(|_| AppError::BadRequest("invalid salt".into()))?;
    if salt.len() != vault_crypto::SALT_LEN {
        return Err(AppError::BadRequest("invalid salt length".into()));
    }

    let auth_key = vault_crypto::AuthKey::from_b64(&req.auth_key)
        .map_err(|_| AppError::BadRequest("invalid auth_key".into()))?;
    let auth_hash = vault_crypto::hash_auth_key(&auth_key).map_err(|_| AppError::Internal("hash failed".into()))?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let result = sqlx::query("INSERT INTO users (id, username, salt, auth_hash, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(username)
        .bind(&salt)
        .bind(&auth_hash)
        .bind(&now)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => Ok(StatusCode::CREATED),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            Err(AppError::Conflict("username already taken".into()))
        }
        Err(e) => Err(e.into()),
    }
}

pub async fn get_salt(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<SaltResponse>, AppError> {
    let row: Option<(Vec<u8>,)> = sqlx::query_as("SELECT salt FROM users WHERE username = ?")
        .bind(&username)
        .fetch_optional(&state.db)
        .await?;
    let (salt,) = row.ok_or(AppError::NotFound)?;
    Ok(Json(SaltResponse {
        salt: vault_crypto::b64_encode(&salt),
    }))
}

pub async fn login(State(state): State<AppState>, Json(req): Json<LoginRequest>) -> Result<Json<LoginResponse>, AppError> {
    let limiter_key = format!("login:{}", req.username);
    if !state.limiter.check(&limiter_key) {
        return Err(AppError::RateLimited);
    }

    let row: Option<(String, String)> = sqlx::query_as("SELECT id, auth_hash FROM users WHERE username = ?")
        .bind(&req.username)
        .fetch_optional(&state.db)
        .await?;

    let Some((user_id, auth_hash)) = row else {
        state.limiter.record_failure(&limiter_key);
        return Err(AppError::Unauthorized);
    };

    let auth_key = vault_crypto::AuthKey::from_b64(&req.auth_key)
        .map_err(|_| AppError::BadRequest("invalid auth_key".into()))?;

    if !vault_crypto::verify_auth_key(&auth_key, &auth_hash) {
        state.limiter.record_failure(&limiter_key);
        return Err(AppError::Unauthorized);
    }
    state.limiter.record_success(&limiter_key);

    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let token_hash = hash_token(&token_bytes);
    let expires_at = Utc::now() + chrono::Duration::hours(SESSION_TTL_HOURS);
    let expires_at_str = expires_at.to_rfc3339();

    sqlx::query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
        .bind(&token_hash)
        .bind(&user_id)
        .bind(&expires_at_str)
        .execute(&state.db)
        .await?;

    Ok(Json(LoginResponse {
        token: vault_crypto::b64_encode(&token_bytes),
        expires_at: expires_at_str,
    }))
}

pub async fn logout(State(state): State<AppState>, auth: AuthUser) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM sessions WHERE token_hash = ?")
        .bind(&auth.token_hash)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_items(State(state): State<AppState>, auth: AuthUser) -> Result<Json<Vec<ItemResponse>>, AppError> {
    let rows: Vec<ItemDbRow> = sqlx::query_as(
        "SELECT id, nonce, ciphertext, created_at, updated_at FROM items WHERE user_id = ? ORDER BY created_at",
    )
    .bind(&auth.user_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows.into_iter().map(ItemResponse::from).collect()))
}

pub async fn create_item(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<ItemRequest>,
) -> Result<Json<ItemResponse>, AppError> {
    let nonce = vault_crypto::b64_decode(&req.nonce).map_err(|_| AppError::BadRequest("invalid nonce".into()))?;
    let ciphertext =
        vault_crypto::b64_decode(&req.ciphertext).map_err(|_| AppError::BadRequest("invalid ciphertext".into()))?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query("INSERT INTO items (id, user_id, nonce, ciphertext, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&auth.user_id)
        .bind(&nonce)
        .bind(&ciphertext)
        .bind(&now)
        .bind(&now)
        .execute(&state.db)
        .await?;

    Ok(Json(ItemResponse {
        id,
        nonce: req.nonce,
        ciphertext: req.ciphertext,
        created_at: now.clone(),
        updated_at: now,
    }))
}

pub async fn get_item(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<ItemResponse>, AppError> {
    let row: Option<ItemDbRow> = sqlx::query_as(
        "SELECT id, nonce, ciphertext, created_at, updated_at FROM items WHERE id = ? AND user_id = ?",
    )
    .bind(&id)
    .bind(&auth.user_id)
    .fetch_optional(&state.db)
    .await?;
    row.map(ItemResponse::from).map(Json).ok_or(AppError::NotFound)
}

pub async fn update_item(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(req): Json<ItemRequest>,
) -> Result<Json<ItemResponse>, AppError> {
    let nonce = vault_crypto::b64_decode(&req.nonce).map_err(|_| AppError::BadRequest("invalid nonce".into()))?;
    let ciphertext =
        vault_crypto::b64_decode(&req.ciphertext).map_err(|_| AppError::BadRequest("invalid ciphertext".into()))?;
    let now = Utc::now().to_rfc3339();

    let result = sqlx::query("UPDATE items SET nonce = ?, ciphertext = ?, updated_at = ? WHERE id = ? AND user_id = ?")
        .bind(&nonce)
        .bind(&ciphertext)
        .bind(&now)
        .bind(&id)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(ItemResponse {
        id,
        nonce: req.nonce,
        ciphertext: req.ciphertext,
        created_at: now.clone(),
        updated_at: now,
    }))
}

pub async fn delete_item(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM items WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&auth.user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}
