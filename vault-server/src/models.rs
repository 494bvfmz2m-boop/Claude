use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub salt: String,    // base64
    pub auth_key: String, // base64
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub auth_key: String, // base64
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub expires_at: String,
}

#[derive(Serialize)]
pub struct SaltResponse {
    pub salt: String,
}

#[derive(Deserialize)]
pub struct ItemRequest {
    pub nonce: String,      // base64
    pub ciphertext: String, // base64
}

#[derive(sqlx::FromRow)]
pub struct ItemDbRow {
    pub id: String,
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct ItemResponse {
    pub id: String,
    pub nonce: String,
    pub ciphertext: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ItemDbRow> for ItemResponse {
    fn from(r: ItemDbRow) -> Self {
        ItemResponse {
            id: r.id,
            nonce: vault_crypto::b64_encode(&r.nonce),
            ciphertext: vault_crypto::b64_encode(&r.ciphertext),
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}
