//! Shared crypto for the vault: zero-knowledge key derivation and item encryption.
//!
//! Design (client-side only — the server never sees any of this except `AuthKey`,
//! which by itself cannot be turned back into the master password or `EncKey`):
//!
//!   master_key = Argon2id(master_password, per_user_salt)
//!   auth_key   = HKDF-SHA256(master_key, info = "vault-auth-key-v1")   // sent to server to log in
//!   enc_key    = HKDF-SHA256(master_key, info = "vault-enc-key-v1")    // stays on the client, encrypts vault items
//!
//! The server additionally re-hashes `auth_key` with Argon2id before storing it, so a
//! stolen database still can't be used to log in directly, only to brute-force guess
//! master passwords (at the cost of two Argon2id runs per guess).

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chacha20poly1305::aead::Aead;
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use hkdf::Hkdf;
use rand::rngs::OsRng;
use rand::RngCore;
use sha2::Sha256;
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const SALT_LEN: usize = 16;
pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 24; // XChaCha20-Poly1305 extended nonce

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("key derivation failed")]
    Kdf,
    #[error("encryption failed")]
    Encrypt,
    #[error("decryption failed (wrong master password or tampered data)")]
    Decrypt,
    #[error("invalid base64 encoding")]
    Base64,
    #[error("invalid length")]
    Length,
}

/// Argon2id parameters for the client-side master key derivation.
/// 64 MiB memory, 3 iterations, 4 lanes — deliberately expensive since this
/// only ever runs interactively on the CLI, never on a hot server path.
fn master_kdf_params() -> Params {
    Params::new(65536, 3, 4, Some(KEY_LEN)).expect("valid argon2 params")
}

#[derive(ZeroizeOnDrop)]
pub struct MasterKey([u8; KEY_LEN]);

#[derive(Clone, ZeroizeOnDrop)]
pub struct EncKey([u8; KEY_LEN]);

#[derive(Clone)]
pub struct AuthKey([u8; KEY_LEN]);

impl Drop for AuthKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Derive the master key from the user's master password. Expensive by design.
pub fn derive_master_key(password: &str, salt: &[u8]) -> Result<MasterKey, CryptoError> {
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, master_kdf_params());
    let mut out = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut out)
        .map_err(|_| CryptoError::Kdf)?;
    Ok(MasterKey(out))
}

fn hkdf_expand(master_key: &MasterKey, info: &[u8]) -> [u8; KEY_LEN] {
    let hk = Hkdf::<Sha256>::new(None, &master_key.0);
    let mut out = [0u8; KEY_LEN];
    hk.expand(info, &mut out).expect("hkdf expand of correct length never fails");
    out
}

pub fn derive_auth_key(master_key: &MasterKey) -> AuthKey {
    AuthKey(hkdf_expand(master_key, b"vault-auth-key-v1"))
}

pub fn derive_enc_key(master_key: &MasterKey) -> EncKey {
    EncKey(hkdf_expand(master_key, b"vault-enc-key-v1"))
}

impl AuthKey {
    pub fn to_b64(&self) -> String {
        b64_encode(&self.0)
    }

    pub fn from_b64(s: &str) -> Result<Self, CryptoError> {
        let bytes = b64_decode(s)?;
        let arr: [u8; KEY_LEN] = bytes.try_into().map_err(|_| CryptoError::Length)?;
        Ok(AuthKey(arr))
    }
}

/// Server-side: hash an `auth_key` for storage (defense in depth against DB leaks).
pub fn hash_auth_key(auth_key: &AuthKey) -> Result<String, CryptoError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(&auth_key.0, &salt)
        .map_err(|_| CryptoError::Kdf)?;
    Ok(hash.to_string())
}

/// Server-side: verify a presented `auth_key` against the stored hash.
pub fn verify_auth_key(auth_key: &AuthKey, stored_hash: &str) -> bool {
    let parsed = match PasswordHash::new(stored_hash) {
        Ok(p) => p,
        Err(_) => return false,
    };
    Argon2::default().verify_password(&auth_key.0, &parsed).is_ok()
}

pub struct Encrypted {
    pub nonce: [u8; NONCE_LEN],
    pub ciphertext: Vec<u8>,
}

/// Encrypt a vault item's plaintext bytes under the client-side `enc_key`.
pub fn encrypt(key: &EncKey, plaintext: &[u8]) -> Result<Encrypted, CryptoError> {
    let cipher = XChaCha20Poly1305::new_from_slice(&key.0).map_err(|_| CryptoError::Encrypt)?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = XNonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| CryptoError::Encrypt)?;
    Ok(Encrypted {
        nonce: nonce_bytes,
        ciphertext,
    })
}

pub fn decrypt(key: &EncKey, nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if nonce.len() != NONCE_LEN {
        return Err(CryptoError::Length);
    }
    let cipher = XChaCha20Poly1305::new_from_slice(&key.0).map_err(|_| CryptoError::Decrypt)?;
    let nonce = XNonce::from_slice(nonce);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::Decrypt)
}

pub fn b64_encode(bytes: &[u8]) -> String {
    B64.encode(bytes)
}

pub fn b64_decode(s: &str) -> Result<Vec<u8>, CryptoError> {
    B64.decode(s).map_err(|_| CryptoError::Base64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_encrypt_decrypt() {
        let salt = generate_salt();
        let master = derive_master_key("correct horse battery staple", &salt).unwrap();
        let enc_key = derive_enc_key(&master);

        let plaintext = b"my super secret note";
        let enc = encrypt(&enc_key, plaintext).unwrap();
        let decrypted = decrypt(&enc_key, &enc.nonce, &enc.ciphertext).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn wrong_password_fails_to_decrypt() {
        let salt = generate_salt();
        let master1 = derive_master_key("correct horse battery staple", &salt).unwrap();
        let master2 = derive_master_key("wrong password", &salt).unwrap();
        let key1 = derive_enc_key(&master1);
        let key2 = derive_enc_key(&master2);

        let enc = encrypt(&key1, b"secret").unwrap();
        assert!(decrypt(&key2, &enc.nonce, &enc.ciphertext).is_err());
    }

    #[test]
    fn auth_key_hash_round_trip() {
        let salt = generate_salt();
        let master = derive_master_key("hunter2", &salt).unwrap();
        let auth_key = derive_auth_key(&master);
        let hash = hash_auth_key(&auth_key).unwrap();
        assert!(verify_auth_key(&auth_key, &hash));

        let master2 = derive_master_key("hunter3", &salt).unwrap();
        let wrong_auth_key = derive_auth_key(&master2);
        assert!(!verify_auth_key(&wrong_auth_key, &hash));
    }

    #[test]
    fn auth_key_and_enc_key_differ() {
        let salt = generate_salt();
        let master = derive_master_key("password", &salt).unwrap();
        let auth_key = derive_auth_key(&master);
        let enc_key = derive_enc_key(&master);
        assert_ne!(auth_key.0, enc_key.0);
    }
}
