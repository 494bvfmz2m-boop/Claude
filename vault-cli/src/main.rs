mod api;
mod config;
mod item;

use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use item::VaultItem;
use std::io::Write;

#[derive(Parser)]
#[command(name = "vault", about = "A zero-knowledge encrypted vault for notes and passwords")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Vault server URL, used by `register`/`login` (default: $VAULT_SERVER_URL or http://127.0.0.1:7878)
    #[arg(long, global = true)]
    server: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a new account on the server
    Register {
        #[arg(long)]
        username: String,
    },
    /// Log in and start a local session
    Login {
        #[arg(long)]
        username: String,
    },
    /// End the current session
    Logout,
    /// Show who is currently logged in
    Whoami,
    /// Add a new vault item
    Add { title: String },
    /// List vault items (titles only)
    List,
    /// Show a vault item in full
    Get {
        /// Item id, or a unique prefix of it (see `vault list`)
        id: String,
        /// Print the password instead of masking it
        #[arg(long)]
        show: bool,
    },
    /// Edit an existing vault item
    Edit {
        /// Item id, or a unique prefix of it
        id: String,
    },
    /// Delete a vault item
    Rm {
        /// Item id, or a unique prefix of it
        id: String,
    },
}

fn prompt(label: &str) -> Result<String> {
    print!("{label}: ");
    std::io::stdout().flush()?;
    let mut line = String::new();
    std::io::stdin().read_line(&mut line)?;
    Ok(line.trim().to_string())
}

fn prompt_password(label: &str) -> Result<String> {
    Ok(rpassword::prompt_password(format!("{label}: "))?)
}

fn prompt_new_master_password() -> Result<String> {
    loop {
        let pw = prompt_password("Master password")?;
        if pw.len() < 8 {
            eprintln!("Master password must be at least 8 characters.");
            continue;
        }
        let confirm = prompt_password("Confirm master password")?;
        if pw != confirm {
            eprintln!("Passwords didn't match, try again.");
            continue;
        }
        return Ok(pw);
    }
}

fn require_session() -> Result<config::Session> {
    config::load_session()?.context("not logged in — run `vault login --username <name>` first")
}

/// Prompt for the master password and derive the local-only encryption key from it.
/// Nothing here is ever sent to the server or written to disk.
fn unlock(session: &config::Session) -> Result<vault_crypto::EncKey> {
    let password = prompt_password("Master password")?;
    let salt = vault_crypto::b64_decode(&session.salt)?;
    let master_key = vault_crypto::derive_master_key(&password, &salt)?;
    Ok(vault_crypto::derive_enc_key(&master_key))
}

fn decrypt_item(enc_key: &vault_crypto::EncKey, it: &api::ItemResponse) -> Result<VaultItem> {
    let nonce = vault_crypto::b64_decode(&it.nonce)?;
    let ciphertext = vault_crypto::b64_decode(&it.ciphertext)?;
    let plaintext = vault_crypto::decrypt(enc_key, &nonce, &ciphertext)
        .context("decryption failed — wrong master password, or the data was tampered with")?;
    Ok(serde_json::from_slice(&plaintext)?)
}

async fn resolve_id(api: &api::Api, token: &str, prefix: &str) -> Result<String> {
    let items = api.list_items(token).await?;
    let matches: Vec<_> = items.into_iter().filter(|i| i.id.starts_with(prefix)).collect();
    match matches.len() {
        0 => bail!("no item matches id '{prefix}'"),
        1 => Ok(matches.into_iter().next().unwrap().id),
        _ => bail!("ambiguous id '{prefix}' matches multiple items, use more characters"),
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Register { username } => cmd_register(cli.server, &username).await,
        Commands::Login { username } => cmd_login(cli.server, &username).await,
        Commands::Logout => cmd_logout().await,
        Commands::Whoami => cmd_whoami(),
        Commands::Add { title } => cmd_add(&title).await,
        Commands::List => cmd_list().await,
        Commands::Get { id, show } => cmd_get(&id, show).await,
        Commands::Edit { id } => cmd_edit(&id).await,
        Commands::Rm { id } => cmd_rm(&id).await,
    }
}

async fn cmd_register(server_override: Option<String>, username: &str) -> Result<()> {
    let server_url = server_override.unwrap_or_else(config::default_server_url);
    let api = api::Api::new(server_url.clone());

    println!("Registering '{username}' on {server_url}");
    println!("Choose your master password carefully: it is never sent to the server and cannot be recovered if you forget it.");
    let password = prompt_new_master_password()?;

    let salt = vault_crypto::generate_salt();
    let master_key = vault_crypto::derive_master_key(&password, &salt)?;
    let auth_key = vault_crypto::derive_auth_key(&master_key);

    api.register(username, &vault_crypto::b64_encode(&salt), &auth_key.to_b64())
        .await?;
    println!("Registered. Run `vault login --username {username}` to start a session.");
    Ok(())
}

async fn cmd_login(server_override: Option<String>, username: &str) -> Result<()> {
    let server_url = server_override.unwrap_or_else(config::default_server_url);
    let api = api::Api::new(server_url.clone());

    let salt_b64 = api.get_salt(username).await.context("user not found or server unreachable")?;
    let salt = vault_crypto::b64_decode(&salt_b64)?;

    let password = prompt_password("Master password")?;
    let master_key = vault_crypto::derive_master_key(&password, &salt)?;
    let auth_key = vault_crypto::derive_auth_key(&master_key);

    let login_resp = api.login(username, &auth_key.to_b64()).await.context("login failed")?;

    let session = config::Session {
        server_url,
        username: username.to_string(),
        salt: salt_b64,
        token: login_resp.token,
        expires_at: login_resp.expires_at,
    };
    config::save_session(&session)?;
    println!("Logged in as {username}. Session valid until {}.", session.expires_at);
    Ok(())
}

async fn cmd_logout() -> Result<()> {
    let Some(session) = config::load_session()? else {
        println!("Not logged in.");
        return Ok(());
    };
    let api = api::Api::new(session.server_url.clone());
    let _ = api.logout(&session.token).await; // best-effort server-side revoke
    config::clear_session()?;
    println!("Logged out.");
    Ok(())
}

fn cmd_whoami() -> Result<()> {
    match config::load_session()? {
        Some(s) => println!(
            "Logged in as {} on {} (session expires {})",
            s.username, s.server_url, s.expires_at
        ),
        None => println!("Not logged in."),
    }
    Ok(())
}

async fn cmd_add(title: &str) -> Result<()> {
    let session = require_session()?;
    let enc_key = unlock(&session)?;

    let item_username = prompt("Username (blank if none)")?;
    let item_password = prompt_password("Password (leave blank for none)")?;
    let url = prompt("URL (blank if none)")?;
    let notes = prompt("Notes (blank if none)")?;

    let item = VaultItem {
        title: title.to_string(),
        username: item_username,
        password: item_password,
        url,
        notes,
    };
    let plaintext = serde_json::to_vec(&item)?;
    let enc = vault_crypto::encrypt(&enc_key, &plaintext)?;

    let payload = api::ItemPayload {
        nonce: vault_crypto::b64_encode(&enc.nonce),
        ciphertext: vault_crypto::b64_encode(&enc.ciphertext),
    };

    let api = api::Api::new(session.server_url.clone());
    let created = api.create_item(&session.token, &payload).await?;
    println!("Added '{title}' (id: {})", created.id);
    Ok(())
}

async fn cmd_list() -> Result<()> {
    let session = require_session()?;
    let enc_key = unlock(&session)?;

    let api = api::Api::new(session.server_url.clone());
    let items = api.list_items(&session.token).await?;

    if items.is_empty() {
        println!("No items yet. Add one with `vault add <title>`.");
        return Ok(());
    }

    println!("{:<10} {:<30} {:<20}", "ID", "TITLE", "USERNAME");
    for it in &items {
        match decrypt_item(&enc_key, it) {
            Ok(item) => println!("{:<10} {:<30} {:<20}", &it.id[..8], item.title, item.username),
            Err(_) => println!("{:<10} <failed to decrypt>", &it.id[..8]),
        }
    }
    Ok(())
}

async fn cmd_get(id_prefix: &str, show: bool) -> Result<()> {
    let session = require_session()?;
    let enc_key = unlock(&session)?;
    let api = api::Api::new(session.server_url.clone());

    let id = resolve_id(&api, &session.token, id_prefix).await?;
    let it = api.get_item(&session.token, &id).await?;
    let item = decrypt_item(&enc_key, &it)?;

    let password_display = if item.password.is_empty() {
        "(none)".to_string()
    } else if show {
        item.password.clone()
    } else {
        "********".to_string()
    };

    println!("Title:    {}", item.title);
    println!("Username: {}", item.username);
    println!("Password: {password_display}");
    println!("URL:      {}", item.url);
    println!("Notes:    {}", item.notes);
    if !show && !item.password.is_empty() {
        println!("(use --show to reveal the password)");
    }
    Ok(())
}

async fn cmd_edit(id_prefix: &str) -> Result<()> {
    let session = require_session()?;
    let enc_key = unlock(&session)?;
    let api = api::Api::new(session.server_url.clone());

    let id = resolve_id(&api, &session.token, id_prefix).await?;
    let it = api.get_item(&session.token, &id).await?;
    let mut item = decrypt_item(&enc_key, &it)?;

    println!("Leave a field blank to keep its current value.");
    let new_title = prompt(&format!("Title [{}]", item.title))?;
    if !new_title.is_empty() {
        item.title = new_title;
    }
    let new_username = prompt(&format!("Username [{}]", item.username))?;
    if !new_username.is_empty() {
        item.username = new_username;
    }
    let new_password = prompt_password("New password (blank to keep current)")?;
    if !new_password.is_empty() {
        item.password = new_password;
    }
    let new_url = prompt(&format!("URL [{}]", item.url))?;
    if !new_url.is_empty() {
        item.url = new_url;
    }
    let new_notes = prompt(&format!("Notes [{}]", item.notes))?;
    if !new_notes.is_empty() {
        item.notes = new_notes;
    }

    let new_plaintext = serde_json::to_vec(&item)?;
    let enc = vault_crypto::encrypt(&enc_key, &new_plaintext)?;
    let payload = api::ItemPayload {
        nonce: vault_crypto::b64_encode(&enc.nonce),
        ciphertext: vault_crypto::b64_encode(&enc.ciphertext),
    };
    api.update_item(&session.token, &id, &payload).await?;
    println!("Updated.");
    Ok(())
}

async fn cmd_rm(id_prefix: &str) -> Result<()> {
    let session = require_session()?;
    let api = api::Api::new(session.server_url.clone());
    let id = resolve_id(&api, &session.token, id_prefix).await?;

    let confirm = prompt(&format!("Type 'yes' to delete item {id}"))?;
    if confirm != "yes" {
        println!("Aborted.");
        return Ok(());
    }
    api.delete_item(&session.token, &id).await?;
    println!("Deleted.");
    Ok(())
}
