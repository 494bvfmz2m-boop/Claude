# Vault

A zero-knowledge encrypted vault for notes and passwords, with a CLI client and a
networked API server, written in Rust.

"Zero-knowledge" means: the server never sees your master password, and never sees
or holds any key capable of decrypting your data. Every vault item is encrypted and
decrypted **on the client**, before it ever leaves your machine. If the server's
database is ever fully compromised, an attacker gets encrypted blobs and password
hashes — never your notes, your passwords, or your master password.

## How it works

```
master_password
      │  Argon2id(password, per-user salt)      [expensive, client-side]
      ▼
  master_key
      │  HKDF-SHA256, two different "info" strings
      ├──────────────► auth_key   → sent to the server to log in
      └──────────────► enc_key    → stays on your machine, encrypts/decrypts items
```

- `auth_key` and `enc_key` are cryptographically independent — knowing one tells you
  nothing about the other, and neither can be turned back into `master_password`.
- The server additionally re-hashes `auth_key` with Argon2id before storing it
  (`hash_auth_key` / `verify_auth_key` in `vault-crypto`), so even a stolen database
  can't be used to log in directly — only to attempt to brute-force the original
  master password (at the cost of two Argon2id runs per guess).
- Vault items are encrypted with **XChaCha20-Poly1305** (24-byte random nonces —
  unlike AES-GCM's 12-byte nonces, collisions aren't a practical concern even with
  a purely random nonce per item).
- Session tokens are 256-bit random values; the server stores only their SHA-256
  hash, so a database leak doesn't hand out valid sessions either.

See `vault-crypto/src/lib.rs` for the implementation and its test suite.

## Project layout

- **`vault-crypto`** — shared crypto: key derivation, HKDF split, AEAD encrypt/decrypt.
- **`vault-server`** — Axum + SQLite API. Stores only salts, hashed auth keys, hashed
  session tokens, and encrypted item blobs.
- **`vault-cli`** — the `vault` command-line client.

## Building

```
cargo build --release --workspace
```

Binaries land in `target/release/vault-server` and `target/release/vault`.

## Running the server

```
VAULT_DB_PATH=vault.db VAULT_BIND_ADDR=127.0.0.1:7878 ./target/release/vault-server
```

- `VAULT_DB_PATH` — SQLite file path (default `vault.db`, created if missing).
- `VAULT_BIND_ADDR` — address to listen on (default `127.0.0.1:7878`).

**The server speaks plain HTTP.** For localhost-only use (the CLI and server on the
same machine) that's fine. To access it from another device, put it behind TLS —
a reverse proxy (Caddy, nginx, Traefik) or an SSH/WireGuard tunnel — rather than
exposing `VAULT_BIND_ADDR` directly to the internet. Without TLS, `auth_key` and
encrypted blobs cross the network unprotected from tampering and replay by a
network observer (though the payloads themselves stay confidential either way,
since encryption already happened client-side). The server logs a warning if you
bind to a non-localhost address as a reminder.

Login attempts are rate-limited per username (5 attempts / 5 minutes, in-memory —
fine for a single instance; a multi-instance deployment would need a shared store).

## Using the CLI

```
export VAULT_SERVER_URL=http://127.0.0.1:7878   # default shown

vault register --username alice     # pick a master password (never sent anywhere)
vault login --username alice        # starts a local session (~/.config/vault-cli)
vault add "GitHub"                  # prompts for username / password / url / notes
vault list                          # decrypts titles locally to show them
vault get <id-prefix>               # add --show to reveal the password
vault edit <id-prefix>              # blank a field to keep its current value
vault rm <id-prefix>                # deletes after a 'yes' confirmation
vault whoami
vault logout                        # revokes the session server-side too
```

Item ids are UUIDs; any unique prefix (as shown by `vault list`) works anywhere an
`<id>` is expected.

**Your master password is asked for on every command that needs to decrypt data**
(`add`, `list`, `get`, `edit`) — it is never cached to disk, only held in memory for
the duration of that single command. This is a deliberate trade-off: a persistent
local session file only ever grants network access to your *encrypted* blobs
(useless without the master password), never decryption capability.

The session file (`~/.config/vault-cli/session.json`) holds only a bearer token,
your username, the server URL, and your (non-secret) salt — permissioned `0600`.
`vault logout` deletes it and revokes the token server-side. Sessions also expire
automatically after 12 hours.

## Known limitations / what a production deployment would add

- No TLS termination built in — deploy behind a reverse proxy for anything beyond
  localhost, as noted above.
- No account recovery: forgetting your master password means losing access to
  everything encrypted with it — that's inherent to genuine zero-knowledge design,
  not a bug.
- Single-instance rate limiting only (in-memory), no distributed lockout store.
- No 2FA, no audit log, no multi-device conflict resolution beyond last-write-wins.
