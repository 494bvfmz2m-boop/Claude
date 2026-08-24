# Xyphros Studios — website

A from-scratch rebuild of xyphros.net: plain HTML/CSS/PHP, no framework,
no database. Content (posts, products, contact messages) lives in JSON
files under `data/`, edited through the staff panel at `/staff/`.

## What's included

- **Public site**: Home, Products, Posts (+ single post view), About,
  Contact — all sharing one header/footer/theme.
- **Products page**: pulls from `data/products.json`. Seeded with
  XyphrosPortal only. Mail (mail.xyphros.net) is intentionally never
  listed anywhere on the public site — it's staff-only infrastructure.
- **Sign in menu**: the "Sign in" button in the header (and the
  Products column in the footer) is generated from
  `data/products.json` — add a product in the staff panel and it shows
  up there automatically, no code changes needed.
- **Staff panel** (`/staff/`): login (password + emailed 2FA code) to
  write/edit/delete posts (with cover image upload), add/edit/delete
  products (with icon upload, status, featured toggle), manage the
  About page's team list (with optional photo), edit the text on the
  Home/About/Contact pages, read contact form submissions, and send
  one-off emails from either of two real mailboxes.
- **Contact form**: validated, CSRF-protected, stored to
  `data/messages.json`, and emailed via real SMTP.

## Your host caches static files — read this

Your hosting (web-hosting.com / LiteSpeed) caches CSS, JS, and image
files aggressively, and on at least one occasion has also served a
**stale cached HTML page** to visitors even after the underlying data
changed. Two things in this codebase specifically fight that:

1. Every reference to a file in `assets/` goes through `asset_url()`
   (see `includes/functions.php`), which appends `?v=ASSET_VERSION`.
   **Whenever you manually replace a file in `assets/` over FTP**
   (a new logo, a hand-edited stylesheet, etc.), bump `ASSET_VERSION`
   in `includes/config.php` by 1. That forces every browser to treat
   it as a brand new URL instead of serving the old cached copy.
   Files you upload through the staff panel (post covers, product
   icons, team photos) don't need this — they already get random
   filenames, so there's nothing to bust.
2. Every page sends `Cache-Control: no-store` (see `no_cache_headers()`
   in `includes/functions.php`), which should stop your host/CDN from
   caching the HTML itself. If you ever add a caching plugin or
   LiteSpeed Cache (LSCache) in cPanel, you may need to exclude `/` and
   `/staff/` from page caching there too, since some hosts cache pages
   at a layer this header can't reach.

If something looks out of date after a deploy, a hard refresh
(Ctrl/Cmd+Shift+R) rules out your own browser's cache as the cause.

## Requirements

- PHP 7.4+ (built and tested on 8.3). No database required.
- The web server's PHP user needs **write access** to `data/` and
  `uploads/` (and their subfolders). On most shared hosts,
  `chmod -R 775 data uploads` after upload is enough; if your host runs
  PHP as a different user than your FTP user, you may need `777` on
  those two folders specifically (not the rest of the site).
- Apache with `.htaccess` support (used to lock down `data/` from
  direct web access and to stop `uploads/` from ever executing a
  script). If you're on nginx instead, see "If you're not on Apache"
  below — the equivalent rules are simple but need to go in your
  server block instead.
- Outbound TCP to your mail host on port 465 (for 2FA codes and
  contact-form email). Shared hosts that give you SMTP credentials
  generally allow this already.

## Deploying

1. Upload everything to your web root (the folder `xyphros.net` points
   at), keeping the folder structure intact.
2. Make sure `data/` and `uploads/` (and their subfolders) are
   writable by PHP (see above).
3. Visit `https://xyphros.net/staff/login.php` and sign in (see
   credentials below) to confirm the staff panel works and the data
   folder is writable — try adding a test product and deleting it again.
4. Edit `includes/config.php`: set `SITE_CONTACT_EMAIL` if you want a
   different fallback (the actual displayed/used address is editable
   from Staff → Page content once the site is live).
5. Edit the team list from Staff → Team instead of editing code.

## Staff login (now with email 2FA)

```
URL:      https://xyphros.net/staff/login.php
Username: administrator
Password: (the one you gave me)
```

After the password, a 6-digit code is emailed to **spontanedonder@hotmail.com**
(set in `TWOFA_EMAIL` in `includes/config.php`) and must be entered
within 10 minutes. The code is never stored in plaintext — only its
hash — and expires, and is rate-limited (5 wrong tries locks that
attempt out).

The password is stored **only as a bcrypt hash** in
`includes/config.php` — the plaintext password isn't saved anywhere in
the code. To change it later, run this once on your server (or any
machine with PHP) and paste the output into `ADMIN_PASSWORD_HASH` in
`includes/config.php`:

```bash
php -r "echo password_hash('YourNewPassword', PASSWORD_BCRYPT), PHP_EOL;"
```

Login is rate-limited: 5 wrong attempts locks that IP out for 5
minutes (`includes/config.php` → `STAFF_MAX_LOGIN_ATTEMPTS` /
`STAFF_LOCKOUT_SECONDS`). Staff sessions also auto-expire after 2 hours
idle (`STAFF_SESSION_TIMEOUT`).

**If you ever get locked out of 2FA** (lost access to the inbox, SMTP
breaks, etc.), set `TWOFA_ENABLED` to `false` in `includes/config.php`
via FTP to log in with just the password, fix whatever's wrong, then
set it back to `true`.

**Recommendation:** since this panel can publish content publicly,
treat the login like any other admin account — don't share it over
chat/email in plaintext going forward, and change it the first chance
you get since it's already been typed into this conversation. The same
goes for the `no-reply@xyphros.net` mailbox password in
`includes/config.php` — consider rotating it too, since it's also been
shared in chat.

## Outgoing email (SMTP)

`includes/mailer.php` is a small, dependency-free SMTP client (no
PHPMailer/composer needed) used for 2FA codes, contact-form
notifications, and staff replies. Settings live in `includes/config.php`:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`,
`SMTP_FROM_EMAIL` (the no-reply@ identity), plus `CONTACT_SMTP_USERNAME` /
`CONTACT_SMTP_PASSWORD` / `CONTACT_FROM_EMAIL` (a second identity, used
only when replying to a message from Staff → Messages, so replies come
from a human-looking address instead of no-reply@). If email ever stops
sending, check your host's error log — failures are logged via
`error_log()` with a short reason (never the password) and the contact
form/2FA flow both degrade gracefully (the contact message is still
saved even if the email fails; a failed 2FA send shows you an error
instead of leaving you stuck).

## Sending email from the staff panel

Staff → **Email** is a one-off email composer — pick a From address
(Contact or No-reply, both configured in `includes/config.php`), fill
in To/Subject/Message, and send. It keeps a simple "Recently sent" log
(`data/sent_emails.json`) so you can see what went out and when.

Staff → **Messages** has a "Reply via Email tab" link on each
submission that jumps to the Email tab with To/Subject pre-filled —
sending that reply also marks the original message "Replied" in the
list, but the actual sending always happens from the one Email tab
rather than a separate form per message.

## Editable page content without touching code

Staff → **Page content** is grouped by which page each section
affects (Homepage / About page / Contact page), each with a "View
page →" link to open that page in a new tab while you edit, and a
short hint under every field explaining what it controls and where it
appears. Staff → **Team** manages the people shown on the About page,
with an optional photo per person.

## Visual polish

A couple of small, native-browser effects, both implemented so they
degrade to nothing (not breakage) if unsupported:

- **Scroll reveal**: headings, cards, and intro text fade/slide into
  view as you scroll to them (`assets/js/main.js`, guarded by
  `prefers-reduced-motion` and `IntersectionObserver` feature
  detection — if either is unavailable, content is just visible
  immediately, same as before).
- **Smoother page-to-page navigation**: a CSS View Transitions rule
  (`@view-transition { navigation: auto; }` in `style.css`) gives a
  soft cross-fade between pages in browsers that support it (Chrome/Edge
  and newer Safari/Firefox); other browsers just navigate instantly as
  they always did.

## Editing colors, fonts, and copy

Everything visual is driven by CSS variables at the top of
`assets/css/style.css` (`:root { ... }`) — change `--violet` /
`--magenta` there to re-theme the whole site, including the staff
panel (which reuses the same stylesheet). Remember to bump
`ASSET_VERSION` after editing this file directly over FTP.

Fonts are loaded from Google Fonts in `includes/header.php` and
`staff/includes/staff-header.php`. Display face is Anton (to match the
logo's bold condensed look), body is Manrope, and JetBrains Mono is
used for small labels/status pills.

## How content is stored

No database — JSON files in `data/`:

- `posts.json` — blog posts
- `products.json` — product cards (seeded with XyphrosPortal)
- `team.json` — About page team members
- `settings.json` — editable page text
- `messages.json` — contact form submissions
- `sent_emails.json` — a simple log of emails sent from Staff → Email (created automatically on first send)

Back these up. If you ever outgrow this (hundreds of posts, multiple
authors), it's a reasonably easy migration to a real database later —
the staff panel's save/load logic is isolated in `includes/functions.php`
(`load_json` / `save_json`).

## Security notes

- The staff password is bcrypt-hashed, never stored in plaintext. The
  SMTP/mailbox password is stored in plaintext in `includes/config.php`
  because SMTP authentication requires the real password — keep that
  file's permissions tight on the server (e.g. 640) and don't commit it
  to a public repo.
- 2FA adds a second factor (an emailed code) on top of the password,
  with its own rate limiting and expiry, and never stores the code
  itself — only its hash.
- All staff forms (and the public contact form) are CSRF-protected.
- Image uploads are validated by actually decoding them as images
  (not just trusting the file extension), renamed to random filenames,
  and `uploads/.htaccess` stops the web server from ever executing
  anything in that folder as a script — even if a malicious file ever
  got past validation.
- `data/.htaccess` blocks direct web access to the raw JSON files.
- Post bodies are stored as plain text and rendered as escaped HTML
  (paragraph breaks only) — even though only the admin account can
  write them, this avoids the post editor becoming a script-injection
  vector if that account is ever compromised.
- Staff pages are marked `noindex, nofollow` and excluded in
  `robots.txt`, on top of the login wall.

This covers the common risks for a small site like this, but it isn't
a substitute for a professional security review if XyphrosPortal ever
starts handling more sensitive data — at that point it's worth a
proper audit.

## If you're not on Apache

The two `.htaccess` files only matter on Apache/LiteSpeed. If you're on
nginx, add the equivalent in your server block instead:

```nginx
location /data/ { deny all; }
location ~* ^/uploads/.*\.(php|phtml|cgi|pl|py|sh)$ { deny all; }
```

## Local preview

```bash
php -S localhost:8000
```

Then open `http://localhost:8000/`.
