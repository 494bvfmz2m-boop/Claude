# Xyphros Studios — website

Plain PHP/CSS/JS, no framework, no build step. Accounts, sessions,
site content (posts/products/team), orders, and license keys live in a
shared MySQL database (`daane_xyphros`) — the same database
XyphrosPortal and the staff panel use, which is what lets one account
work across every `*.xyphros.net` subdomain. See `includes/XyphrosAuth.php`
(accounts/sessions) and `includes/Content.php` (everything else).

## What's included

- **Public site** — Home, Products, Posts, About, Contact, Store.
- **Accounts** — sign up/in, email verification, password reset,
  email 2FA or authenticator-app 2FA, active-device management, all in
  `/login`, `/register`, `/forgot-password`, `/account`.
- **Store** (Tebex-backed) — `/store` lists categories/packages from
  Tebex's Headless API and checks out through Tebex's hosted checkout
  widget. Requires signing in AND linking Discord first (see below).
- **Discord account linking** — a customer links their Discord account
  once, from `/account?tab=connections` (or the prompt on `/store`).
  From then on, every purchase automatically grants the matching
  Discord role once payment completes — see "Discord linking" below.
- **License keys** — some Tebex packages (see `TEBEX_LICENSE_PACKAGES`
  in config) auto-issue a Portal workspace-limit license key on
  purchase, emailed to the buyer and viewable from Account → Orders.

## Requirements

- PHP 8.1+ with `pdo_mysql`, `curl`, and `gd` (image validation) extensions.
- MySQL/MariaDB — the shared `daane_xyphros` database.
- Apache with `.htaccess` support (clean URLs, security headers,
  blocking direct access to `data/`, `includes/`, and script execution
  in `uploads/`). On nginx, port the rules in `.htaccess` to your
  server block instead.
- Outbound HTTPS (Tebex API, Discord API) and outbound TCP 465 (SMTP).

## First-time setup

1. `cp includes/config.local.example.php includes/config.local.php`
   and fill in every value: DB credentials, SMTP credentials, Discord
   bot token + OAuth app credentials, Tebex keys. **This file holds
   real secrets — it's already listed in `.gitignore`, never commit it
   or upload it anywhere public.** Lock its permissions down on the
   server: `chmod 640 includes/config.local.php`.
2. Run `migration-discord-linking.sql` once against the shared
   database (adds the Discord-link columns on `users` and the
   `login_attempts` table). It's idempotent — safe to run again if
   you're not sure whether it already ran.
3. Make sure `data/`, `uploads/`, and their subfolders are writable by
   PHP (`chmod -R 775`, or `777` on hosts that run PHP as a different
   user than FTP).
4. Set `ASSET_VERSION` in `includes/config.php` up by one any time you
   hand-edit a file in `assets/` over FTP, so browsers don't keep
   serving a stale cached copy.

## Discord linking — how it fits together

Tebex can only grant a Discord role automatically if it knows which
Discord account a customer is. The old approach (Tebex's own
per-purchase "log in with Discord" step, configured as a required
package option) meant reconnecting Discord on every single purchase,
and any hiccup in that round trip surfaced as an unhelpful "couldn't
find account" error with nothing the customer could do about it.

Instead:

1. A customer links Discord to their Xyphros account **once**, via
   Discord's own OAuth2 (`/discord-link` → Discord → `/discord-callback`,
   see `includes/Discord.php`). We only ever request the `identify`
   scope — just their Discord user ID and username, nothing else.
2. `/store` requires that link before showing the "Buy now" buttons at
   all (`store.php`), and `store-buy.php` checks again server-side.
3. Every basket created for them carries `discord_id` as custom data,
   and `xs_store_finalize_purchase()` snapshots it onto the pending
   order too.
4. Once Tebex's `payment.completed` webhook fires (`webhook-tebex.php`),
   `Discord::grantRoleForOrder()` looks up the purchased package in
   `TEBEX_DISCORD_ROLES` (config) and grants that role directly via the
   bot token — no dependency on Tebex's own Discord integration at all.

**To finish setting this up on your end:**

- Create/open a Discord application at
  https://discord.com/developers/applications.
- **Bot tab**: copy the bot token into `DISCORD_BOT_TOKEN`. Invite the
  bot to your server with the "Manage Roles" permission, and make sure
  its highest role sits *above* every role it needs to grant (Discord
  enforces this — a bot can't grant a role ranked above its own).
- **OAuth2 tab**: copy the Client ID/Secret into `DISCORD_CLIENT_ID` /
  `DISCORD_CLIENT_SECRET`, and add
  `https://xyphros.net/discord-callback` as a redirect URL there
  (must match `DISCORD_OAUTH_REDIRECT_URI` exactly).
- Enable Developer Mode in Discord (User Settings → Advanced) so you
  can right-click to copy IDs: your server → `DISCORD_GUILD_ID`; each
  role you want a package to grant → `TEBEX_DISCORD_ROLES` in
  `includes/config.php` (`package_id => role_id`).

## Deploying

1. Upload everything to your web root, keeping the folder structure.
2. Follow "First-time setup" above if you haven't already.
3. Sign in with an existing account (or register a new one) and
   confirm `/account` and `/store` both load.
4. If you rotate any secret in `config.local.php`, no redeploy is
   needed — PHP reads it fresh on the next request.

## Security notes

- Real credentials live only in `includes/config.local.php`, which is
  gitignored and blocked from direct web access (`includes/` is denied
  in `.htaccess`). `includes/config.php` itself has no secrets in it
  and is safe to keep in version control.
- Passwords are bcrypt-hashed (cost 12). Sessions are random 256-bit
  tokens, stored server-side as a SHA-256 hash, delivered as an
  `httponly`, `secure`, `SameSite=Lax` cookie shared across
  `*.xyphros.net`.
- Login is throttled: 8 failed attempts against one email within 15
  minutes blocks further attempts on that email for the rest of the
  window (`LOGIN_MAX_ATTEMPTS` / `LOGIN_THROTTLE_WINDOW`,
  `login_attempts` table — see the migration).
- 2FA (email code or TOTP authenticator app) is available per-account
  from Account → Password & 2FA. Codes are single-use, expire, are
  rate-limited to 5 attempts, and are never stored in plaintext.
- CSRF protection on every state-changing form: session-derived tokens
  once signed in (`XyphrosAuth::csrfToken()`), cookie-derived tokens on
  the logged-out auth pages (`xs_csrf_token()`).
- The Tebex webhook verifies an HMAC-SHA256 signature over the raw
  request body before trusting anything in it — a guessed/leaked
  webhook URL alone isn't enough to fake an order.
- Image uploads are validated by actually decoding them as images (not
  trusting the extension), renamed to random filenames, and
  `uploads/.htaccess` stops that folder from ever executing a script.
- `data/.htaccess` and `includes/` (via the root `.htaccess`) block
  direct web access; both are duplicated site-wide via
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, a
  baseline `Content-Security-Policy`, and HSTS (see `.htaccess`).

This covers the common risks for a site this size, not a substitute
for a professional audit if the account system ever starts handling
more sensitive data.

## Local preview

```bash
php -S localhost:8000
```

You'll still need a real MySQL connection (see `config.local.php`) for
anything beyond the static marketing pages — there's no offline/mock
mode for the account system.
