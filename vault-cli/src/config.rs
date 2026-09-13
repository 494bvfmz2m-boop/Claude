use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Cached locally after `vault login`. Note this deliberately contains only
/// a bearer session token, never the master password or any derived key —
/// those exist in memory for the lifetime of a single command and nowhere else.
#[derive(Serialize, Deserialize, Clone)]
pub struct Session {
    pub server_url: String,
    pub username: String,
    pub salt: String, // base64, not secret
    pub token: String, // base64 bearer token
    pub expires_at: String,
}

fn config_dir() -> Result<PathBuf> {
    let mut dir = dirs::config_dir().ok_or_else(|| anyhow::anyhow!("could not determine config directory"))?;
    dir.push("vault-cli");
    Ok(dir)
}

fn session_path() -> Result<PathBuf> {
    let mut p = config_dir()?;
    p.push("session.json");
    Ok(p)
}

pub fn default_server_url() -> String {
    std::env::var("VAULT_SERVER_URL").unwrap_or_else(|_| "http://127.0.0.1:7878".to_string())
}

pub fn load_session() -> Result<Option<Session>> {
    let path = session_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&data)?))
}

pub fn save_session(session: &Session) -> Result<()> {
    let dir = config_dir()?;
    fs::create_dir_all(&dir)?;
    let path = session_path()?;
    let data = serde_json::to_string_pretty(session)?;
    fs::write(&path, data)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

pub fn clear_session() -> Result<()> {
    let path = session_path()?;
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}
