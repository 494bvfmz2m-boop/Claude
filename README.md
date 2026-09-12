# Xyphros Studios — website

Plain PHP/CSS/JS, no framework, no build step. Accounts, sessions,
site content (posts/products/team), orders, and license keys live in a
shared MySQL database (`daane_xyphros`) — the same database
XyphrosPortal uses, which is what lets one account work across every
`*.xyphros.net` subdomain. See `includes/XyphrosAuth.php`
(accounts/sessions) and `includes/Content.php` (everything else).

The internal staff admin panel (`/staff`) lives in this same codebase
now — it used to be a separate deployment on staff.xyphros.net with
its own copy of every shared class; that's gone, there's exactly one
copy of `XyphrosAuth`/`Content`/etc, and one `config.local.php`.

## What's included

- **Public site** — Home, Products, Posts, About, Contact, Store.
- **Accounts** — sign up/in, email verification, password reset,
  email 2FA or authenticator-app 2FA, active-device management, all in
  `/login`, `/register`, `/forgot-password`, `/account`.
- **Store** (Tebex-backed) — `/store` lists categories/packages from
  Tebex's Headless API and checks out through Tebex's hosted checkout
  widget. For any package with Tebex's built-in `discord_id` required
  option, `store-buy.php` supplies the customer's linked Discord ID
  (see below) directly when adding the package to the basket — Tebex's
  own Discord Servers integration is what actually grants the role
  once payment completes; this site only ever supplies the ID.
- **Discord account linking** — a customer links their Discord account
  at `/account?tab=connections` (`/discord-link` → Discord OAuth2 →
  `/discord-callback`, see `includes/Discord.php`). Required before
  buying any package that needs a Discord role — `store-buy.php` sends
  the customer to link first if they haven't.
- **License keys** — some Tebex packages (see `TEBEX_LICENSE_PACKAGES`
  in config) auto-issue a Portal workspace-limit license key on
  purchase, emailed to the buyer and viewable from Account → Orders.
- **Support chat** — a signed-in customer gets a floating chat bubble
  (bottom-right, see `includes/support-widget.php`) to message staff;
  the conversation is saved to their account (visible under Account →
  Support) until a staff member closes it from `/staff/tickets`. See
  `includes/SupportTicket.php` and `migration-support-tickets.sql`.
- **Staff panel** (`/staff`) — manage posts/products/team/page content,
  read contact-form messages and the support chat inbox, send email,
  manage site-wide broadcast banners, search/lock/reset accounts, view
  orders and license keys, and (Founder-only) grant staff access, set
  per-staff permissions, and read the audit log. Gated on the same
  account system as the public site — no separate login. A Founder is
  any account with `is_super_admin`; everyone else needs
  `is_xyphros_staff` plus whatever specific permissions a Founder
  grants them from `/staff/permissions` (see `includes/Permissions.php`
  for the full list). Every sensitive staff action is recorded in
  `includes/AuditLog.php`, readable at `/staff/audit`.

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
2b. Run `migration-support-tickets.sql` once too (adds the
    `support_tickets` and `support_messages` tables). Also idempotent.
2c. Run `migration-staff-panel.sql` once too (adds the
    `is_subtracker_staff` column the Staff Access / Broadcasts pages
    need for the third product tab). Also idempotent.
2d. Run `migration-avatar-to-db.sql` once too (widens the `avatar`
    column to MEDIUMTEXT). Profile pictures are now stored as a
    `data:` URI directly in the database instead of a file in
    `uploads/avatars/`, so they can't be lost by a redeploy that
    doesn't carry `uploads/` along with it. Existing file-based avatars
    keep working unchanged; only a fresh upload switches to DB storage.
3. Make sure `data/`, `uploads/`, and their subfolders are writable by
   PHP (`chmod -R 775`, or `777` on hosts that run PHP as a different
   user than FTP).
4. Set `ASSET_VERSION` in `includes/config.php` up by one any time you
   hand-edit a file in `assets/` over FTP, so browsers don't keep
   serving a stale cached copy.
5. To reach `/staff` at all, at least one account needs
   `is_super_admin = 1` (a "Founder") — there's no UI for granting the
   very first one, since `/staff/access` (where staff access is
   normally granted) is itself Founder-only. Set it directly once,
   after registering a normal account:
   `UPDATE users SET is_super_admin = 1 WHERE email = 'you@example.com';`
   Every Founder can grant `is_xyphros_staff` (regular staff) or
   `is_super_admin` (another Founder) to other accounts from
   `/staff/access` after that.

## Discord — role granting and account linking

Store role delivery is Tebex's job, via their **Discord Servers**
integration (Tebex creator dashboard: install their official bot in
your Discord server, run `/link` with the secret key shown there, and
make sure the bot's role sits above every role it needs to assign).
This site never grants a role directly — it only supplies Tebex with
the piece it needs to do that.

That piece is a per-customer Discord ID, and here's why account
linking exists: a package requiring Discord role delivery has Tebex's
built-in `discord_id` required option on it, normally filled in by
sending the customer through Tebex's own hosted "log in with Discord"
step (`GET /baskets/{ident}/auth`). On at least one account that
endpoint has been broken — returns success with no usable login URL —
which blocked every purchase of every Discord-role package with no
workaround available from the Tebex dashboard.

The fix (confirmed working): a customer links Discord to their Xyphros
account once, at `/account?tab=connections` — plain Discord OAuth2
(`identify` scope only), handled by `/discord-link` →
`/discord-callback` (see `includes/Discord.php`). `store-buy.php` then
supplies that linked ID directly as the package's `discord_id` option
when adding it to the basket, which Tebex accepts — sidestepping their
broken auth endpoint entirely. If a customer hasn't linked yet,
`store-buy.php` sends them to `/discord-link` first instead of falling
into the broken flow.

If Tebex ever fixes that endpoint for this account, this workaround
keeps working exactly the same (linking becomes an optional shortcut
rather than a requirement) — nothing here depends on that endpoint
staying broken, it only depends on Tebex accepting a client-supplied
`discord_id`, which it demonstrably does.

**To set up account linking**, create/open a Discord application at
https://discord.com/developers/applications, open its **OAuth2** tab,
copy the Client ID/Secret into `DISCORD_CLIENT_ID` /
`DISCORD_CLIENT_SECRET`, and add `https://xyphros.net/discord-callback`
as a redirect URL there (must match `DISCORD_OAUTH_REDIRECT_URI`
exactly). `DISCORD_BOT_TOKEN` is separate and only used by the staff
"fetch avatar from Discord" button — not related to any of the above.

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
- CSRF protection on every state-changing form: session-cookie-derived
  tokens once signed in (`XyphrosAuth::csrfToken()`), plain-cookie
  tokens on the logged-out auth pages (`xs_csrf_token()`), and PHP
  native-session tokens on the contact form and every staff form
  (`csrf_field()`/`csrf_verify()`). The last one only works if
  `xs_session_start()` runs before any HTML output — `session_start()`
  silently fails to set its cookie once output has begun, which would
  make the form always fail its own CSRF check. `contact.php` and
  `staff/includes/staff-auth.php` both call it first thing, before
  their layout include — keep that ordering if you ever touch either.
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
