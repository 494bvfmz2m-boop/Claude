# Custom Webmail — Deployment Guide

## What this is
A self-hosted, secure PHP webmail app. One login page supports multiple domains
on the same server. All mail is fetched live from your IMAP server — nothing is
stored in a database.

---

## File structure
```
webmail/
├── public/           ← Upload this folder to your web root
│   ├── index.html    ← The frontend (single-page app)
│   ├── api.php       ← The backend (all IMAP/SMTP/session logic)
│   └── .htaccess     ← Security headers + HTTPS redirect
└── src/
    ├── Mail.php      ← IMAP + SMTP class
    └── config.php    ← YOUR SETTINGS (edit before deploying)
```

---

## Step 1 — Edit config.php

Open `src/config.php` and set:

```php
'imap_host'       => 'mail.yourdomain.com',  // Your mail server hostname
'imap_port'       => 993,                     // IMAP SSL port (usually 993)
'smtp_port'       => 465,                     // SMTP SSL port (465 or 587)
'allowed_domains' => ['domain1.com', 'domain2.com', 'domain3.com'],
'app_name'        => 'Mail',                  // Shown in the UI
```

---

## Step 2 — Upload via FTP/SFTP

Upload the **entire `webmail/` folder** to your server. The recommended structure:

```
/var/www/html/mail/       ← or wherever your web root is
  ├── index.html
  ├── api.php
  ├── .htaccess
  └── src/
      ├── Mail.php
      └── config.php
```

Make sure `src/` is **not** web-accessible (the .htaccess blocks it, but for
extra safety you can place it above the web root).

---

## Step 3 — PHP requirements

Your server needs:
- PHP 7.4+ (PHP 8.x recommended)
- `php-imap` extension enabled
- `openssl` extension enabled

Check with:
```bash
php -m | grep -E 'imap|openssl'
```

If `imap` is missing, on Ubuntu/Debian:
```bash
sudo apt install php-imap && sudo service apache2 restart
```

---

## Step 4 — Set permissions

```bash
chmod 644 public/api.php public/index.html public/.htaccess
chmod 644 src/Mail.php src/config.php
chmod 755 public/ src/
```

---

## Step 5 — Test

Visit `https://mail.yourdomain.com` (or wherever you uploaded it).
Log in with a real email address from one of your allowed domains.

---

## Security features built in

| Feature | How |
|---|---|
| HTTPS enforced | .htaccess redirects HTTP → HTTPS |
| Session hardening | httponly, secure, SameSite=Strict cookies |
| Session rotation | ID rotated on every authenticated request |
| CSRF protection | Token required on all write operations |
| Rate limiting | Login: 5/min · Send: 20/min |
| Domain allowlist | Only your domains can log in |
| CSP header | Blocks inline JS injection, framing, etc. |
| Credentials | Never stored — only held in PHP session memory |
| HTML sanitization | Scripts/iframes stripped from message bodies |

---

## Profile pictures

Under **Account → Identity & Signature** you can upload a profile picture.
It's resized/cropped to a square in the browser before upload (so nothing
huge ever gets sent), validated server-side (type, size, and that it's a
real image), and stored alongside your display name and signature in
`src/identities/<your-email>.json`. It shows up in the sidebar and in the
"how you appear to recipients" preview.

---

## SMTP port note

If port 465 doesn't work, try 587. Edit `config.php`:
```php
'smtp_port' => 587,
```
And in `Mail.php`, change the `stream_socket_client` line from `ssl://` to `tls://`:
```php
"tls://{$this->host}:{$this->smtpPort}"
```

---

## Troubleshooting

**"Invalid email or password" even though the password is correct**
→ Purelymail (and several other providers) can require a separate **mailbox
  password**, distinct from your account/login password, before IMAP/SMTP
  access works — check your provider's mail client / app-password settings.
→ The login error now distinguishes real credential failures from
  connection failures. If the actual problem is TLS/network/server related,
  you'll see "Could not connect to the mail server" instead — check the PHP
  error log (see below) for the exact IMAP error, which is now recorded on
  every failed login attempt.

**"Could not connect to mail server"**
→ Check that `imap_host`, ports, and credentials are correct.
→ Make sure `php-imap` is installed.
→ Check your server firewall allows outbound 993/465.

**Blank page / 500 error**
→ Check PHP error log: `tail -f /var/log/apache2/error.log`

**Folders don't show non-ASCII names correctly**
→ This is usually IMAP UTF-7 encoding. The app handles it automatically, but some
  server configs vary. Contact your host if folder names look garbled.
