use crate::error::AppError;
use crate::state::AppState;
use axum::extract::FromRequestParts;
use axum::http::header;
use axum::http::request::Parts;
use sha2::{Digest, Sha256};

pub fn hash_token(token_bytes: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(token_bytes);
    hasher.finalize().to_vec()
}

/// Extractor that authenticates a request via `Authorization: Bearer <base64 token>`,
/// looking up the *hash* of the presented token (never the raw token) in the sessions
/// table, and rejecting expired sessions.
pub struct AuthUser {
    pub user_id: String,
    pub token_hash: Vec<u8>,
}

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let header_val = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token_b64 = header_val.strip_prefix("Bearer ").ok_or(AppError::Unauthorized)?;
        let token_bytes = vault_crypto::b64_decode(token_b64).map_err(|_| AppError::Unauthorized)?;
        let token_hash = hash_token(&token_bytes);

        let row: Option<(String, String)> =
            sqlx::query_as("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
                .bind(&token_hash)
                .fetch_optional(&state.db)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;

        let (user_id, expires_at) = row.ok_or(AppError::Unauthorized)?;
        let expires_at: chrono::DateTime<chrono::Utc> =
            expires_at.parse().map_err(|_| AppError::Internal("bad expires_at".into()))?;

        if expires_at < chrono::Utc::now() {
            return Err(AppError::Unauthorized);
        }

        Ok(AuthUser { user_id, token_hash })
    }
}
