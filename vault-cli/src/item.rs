use serde::{Deserialize, Serialize};

/// The plaintext shape of a vault item. This struct is serialized to JSON and
/// that JSON is what actually gets encrypted — the server only ever sees the
/// resulting ciphertext.
#[derive(Serialize, Deserialize, Default, Clone)]
pub struct VaultItem {
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: String,
    pub notes: String,
}
