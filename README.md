# SlothSMP Website

A full site for a Minecraft SMP: rules, announcements, member accounts, a
role-based admin panel, a live server-status widget, a support-ticket system,
and a **Tebex-powered store**. Accounts, roles, posts, tickets, and store
order logs live in a MySQL database; site settings (server IP, banner text,
rules text, active theme) live in `data/settings.json`.

This is a ground-up rewrite of the previous version of this site — same
feature set, cleaner code (a single `includes/bootstrap.php` instead of a
4-line include chain on every page, a refreshed responsive design), plus the
new store.

## 1. Set up the database (do this first, before uploading)

This site expects a MySQL/MariaDB database, with a user that has access to
it. Create both first if your host doesn't already have them (most hosts do
this through a "MySQL Databases" section in cPanel or similar) — call them
whatever you like.

Then **import `schema.sql`** into that database — phpMyAdmin's SQL tab (paste
the whole file, click Go) or `mysql -u youruser -p yourdb < schema.sql` over
SSH. It's safe to re-run any time, on a brand-new database or one that
already has real accounts/posts/tickets in it from an earlier deployment —
it only creates tables/columns that are missing and never touches existing
data.

**Database credentials** live in `includes/db_config.php` — copy
`includes/db_config.example.php` to `db_config.php` (same folder) and fill
in your real values:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');
```
`localhost` is correct for almost every shared host. **`db_config.php` is
gitignored on purpose** — a database password is a live secret and should
never be committed to source control. Upload it directly to your host
(FTP/file manager) next to the example file; `includes/config.php` picks it
up automatically if present.

## 2. Upload

Upload the **entire contents of this folder** to your host, keeping the
folder structure intact (`admin/`, `api/`, `assets/`, `data/`, `includes/`,
plus the PHP files in the root). If your host puts the web root at
`public_html/`, everything here goes inside `public_html/`.

Requirements: PHP 8.0+, the `pdo_mysql` extension, and the `curl` extension
(used by the server-status widget and the Tebex store).

## 3. Set your real site URL

Open `includes/config.php` and change:
```php
define('SITE_URL', 'https://slothsmp.com'); // <-- your real domain, no trailing slash
```

## 4. Log in to the admin panel

Go to `https://yourdomain.com/login` with:
- **Email:** `Management@slothsmp.com`
- **Password:** `Spont.Sloth.10`

**Change this password immediately.** Log out, go to `/forgot-password`,
enter that email, and follow the emailed link — or edit `password_hash`
directly in phpMyAdmin's `users` table using
`php -r 'echo password_hash("YourNewPassword", PASSWORD_DEFAULT);'` if
outgoing email isn't set up yet.

The Management account holds the **Core role** (protected — can't be
deleted or removed from an account via the UI). `includes/config.php` also
has a `SUPER_OP_EMAILS` list (currently `spontanedonder@hotmail.com`) as a
permanent owner override that always has every permission regardless of
roles — see `schema.sql` for the matching `is_super_op` flag.

## 5. Set your server info

**Admin → Settings**: site name, banner text, Java/Bedrock IP + port (feeds
the live status widget automatically), Discord invite link, both rule lists.

## 6. Roles and permissions

**Admin → Roles**: create roles and pick permissions — manage posts, manage
users, manage roles, manage settings, manage support tickets, and view store
orders. Each role has a **weight**: an admin can never edit, delete, grant,
or remove a role with a higher weight than their own highest-weight role,
even with every permission checked. Roles with **Staff** on show up on the
public `/staff` page, heaviest weight first; roles can use a 2-color
gradient badge instead of a solid color.

**Admin → Users** assigns roles to accounts.

### Super op

`users.is_super_op` (settable via `UPDATE users SET is_super_op = 1 WHERE
email = '...';` in phpMyAdmin) always has every permission and always
outranks every role, no matter what's actually assigned — a permanent
"owner" override so nobody can get locked out.

## 7. Logging in with a username

The login field accepts either an email or a username — anything with `@`
is treated as an email.

## 8. Two-factor authentication

Anyone can turn it on from **Account**: an authenticator app (TOTP, scan a QR
code or enter the key manually — the QR is rendered by the third-party
`api.qrserver.com`, which sees the secret as part of that image request; use
the manual code instead if that's not okay for your setup) or email codes
(6-digit, 10-minute expiry). Turning it off requires re-entering the current
password.

## 9. Drag-and-drop staff ordering

**Admin → Staff Order** (needs "Manage roles"): drag anyone into any order on
the public `/staff` page, independent of role weight. "Reset to automatic
order" clears manual positions for everyone currently on the list.

## 10. Header nav auto-collapse

Extra nav links collapse into a "More ▾" dropdown once they no longer fit
next to the logo/login buttons — recalculated live on resize.

## 11. Theme

**Admin → Theme**: Default, Halloween, Christmas, Valentine's Day, or
Summer, each with an optional falling-particle effect (bats/snow/hearts/
waves) that turns itself off for anyone with "reduce motion" enabled.

## 12. Posts & announcements

**Admin → Posts** (needs "Create & manage posts"). Posts marked
"Announcement" get a different tag on the front end.

## 13. Support tickets

`/support` — real back-and-forth conversations, not one-shot messages.
Guests get an emailed private link (`/ticket?id=...&token=...`); logged-in
members see their history at the bottom of `/support`. Staff work from
**Admin → Tickets** (open-count badge in the sidebar). A reply from the
submitter's side reopens a closed ticket automatically, and whoever isn't
replying gets an email notification when we have an address for them.

## 14. The Tebex store

`/store` lists your Tebex webstore's categories and packages, lets visitors
add items to a basket, and hands off to Tebex's own hosted checkout page —
this site never touches payment details directly. **Admin → Store** shows a
connection-status check and a log of completed orders (once the webhook
below is set up).

### Connecting your store

Copy `includes/tebex_config.example.php` to `includes/tebex_config.php`
(same folder) and fill in your keys from the Tebex Creator Panel — your
store → API keys / Headless API:

```php
define('TEBEX_PUBLIC_TOKEN', 'your-public-token');
define('TEBEX_PRIVATE_KEY', 'your-private-key');
```

**`tebex_config.php` is gitignored on purpose** — it holds a live secret
(the Private Key) that must never be committed to source control or sent to
a browser. Upload it directly to your host (FTP/file manager) next to the
example file; every request that uses it happens server-side in
`includes/tebex.php`.

Packages, categories, prices, and images are all managed in the
[Tebex Creator Panel](https://creator.tebex.io) — this site only displays
and sells whatever's set up there.

**Minecraft username at checkout**: since most servers run offline-mode (no
Mojang account verification), the store asks for a Minecraft username before
letting someone add anything to their basket, and attaches it to the Tebex
basket so the purchase gets delivered to the right player. Logged-in members
can save theirs permanently under **Account**, so it's pre-filled next time.

**Order log (optional but recommended)**: in the Creator Panel, add a
webhook pointing to `https://yourdomain.com/api/tebex_webhook` so completed
purchases show up on **Admin → Store**. The storefront and checkout
themselves work fine without this — it's purely a convenience log.

## 15. Email verification

New accounts get a verification link via PHP's `mail()`. Most shared hosts
have this working by default, but deliverability depends on your domain's
SPF/DKIM setup. If verification emails aren't arriving, switch
`includes/mailer.php`'s `send_site_email()` to an SMTP sender using
PHPMailer (https://github.com/PHPMailer/PHPMailer).

## 16. The Minecraft connector

`api/server_status.php` calls the free `api.mcsrvstat.us` lookup with
whatever IP/port is set in Settings and returns live player counts as JSON,
cached 45 seconds. No API key needed.

## 17. Security notes

- Passwords hashed with bcrypt (`password_hash`), never stored in plain text.
- Sessions last 31 days, refreshed on every visit.
- Every form is CSRF-protected.
- All database queries use PDO prepared statements — no raw string-
  concatenated SQL.
- `data/` and `includes/` ship with `.htaccess` files blocking direct web
  access (Apache only — ask your host to block these paths at the server
  level if they run Nginx).
- All output is escaped (`htmlspecialchars`) to prevent XSS.
- The Tebex **Private Key** lives only in the gitignored
  `includes/tebex_config.php` and is only ever used server-side.

## 18. Clean URLs

`/login` instead of `/login.php`, and so on, via `.htaccess` (Apache +
`mod_rewrite`, `AllowOverride All`/`FileInfo`). Nginx ignores `.htaccess`
entirely — ask your host to add an equivalent `try_files` rule. The site
still works at the `.php` URLs directly if the rewrite isn't active yet.

## File map

```
schema.sql               Database schema + seed data — safe to (re-)import any time
index.php                Homepage — banner, live status widget, latest posts
rules.php / staff.php / announcements.php / post.php
support.php / ticket.php Support ticket submission + conversation view
store.php / basket.php / order-return.php   Tebex-powered store
account.php              Username, password, Minecraft username, 2FA setup
register.php / login.php / logout.php / verify.php
two-factor.php / forgot-password.php / reset-password.php
admin/                   Admin panel (dashboard, posts, roles, users, tickets, store, settings, theme, staff order)
api/server_status.php    Minecraft server status JSON endpoint
api/tebex_webhook.php    Logs completed Tebex orders for Admin -> Store
includes/bootstrap.php   Single include every page requires
includes/tebex.php       Tebex Headless API client
includes/database.php    MySQL/PDO connection + query helpers
includes/db.php          JSON read/write helpers (site settings + caches only)
includes/totp.php        Self-contained TOTP (RFC 6238) implementation
data/                    settings.json + caches (NOT accounts — those are in MySQL)
assets/                  CSS + JS + brand images
```
