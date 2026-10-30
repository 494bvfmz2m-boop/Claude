# EderveenGroup

A fast, refined webmail client for **[Purelymail](https://purelymail.com)**. It runs on your own server and talks to Purelymail over IMAP and SMTP (SSL/TLS).

## Features

- **Login with your Purelymail account.** Credentials are checked live against `imap.purelymail.com`.
- **Stay signed in for 30 days.** Sessions are encrypted client-side cookies (AES-256-GCM, HttpOnly, SameSite). The 30-day window slides while you keep using it. Untick "keep me signed in" for a browser-session-only login.
- **Three-pane inbox** with folders, unread badges, sender avatars, message previews, pagination, search, and filters (Unread / Starred / Attachments).
- **Live new mail** via IMAP IDLE pushed to the browser with Server-Sent Events, plus desktop notifications.
- **Safe HTML email.** Messages are sanitized on the server and rendered in a script-less sandboxed iframe. Remote images (tracking pixels) are blocked until you allow them per message or per sender.
- **Rich composer** with formatting, recipient chips with contact autocomplete, Cc/Bcc, drag-and-drop attachments, reply / reply all / forward (forwarded attachments included), a "you forgot the attachment" check, and **undo send**.
- **Drafts** auto-save to your Purelymail Drafts folder. Close the composer and it's saved; open a draft to keep going.
- **Signatures.** Create as many as you want with the rich editor or raw HTML, start from templates, set separate defaults for new mail and for replies, and switch while composing.
- **Organize:** star, read/unread, archive, spam, delete (with undo), move, drag messages onto folders, multi-select (shift-click ranges), create/delete folders, empty Trash/Junk, and right-click menus.
- **Keyboard first:** `c` `/` `j` `k` `r` `a` `f` `e` `#` `s` `u` `x`, a `Ctrl K` command palette, and `?` for the full list.
- **Feels instant:** messages are prefetched on hover, and folders you've visited render from cache while refreshing in the background.
- **Make it yours:** dark/light/system theme (warm black and paper-white), champagne-gold accent or any colour you pick, comfortable/compact density.
- **Mobile friendly** with a slide-out folder drawer and a full-screen composer.
- View original source, download `.eml`, print, and one-click unsubscribe.

## Run it

Requires Node.js 20.12+.

```bash
cd ederveengroup
npm install
cp .env.example .env   # then set SESSION_SECRET
npm start
```

Open http://localhost:3000 and sign in with your full Purelymail address and password. An [app password](https://purelymail.com/manage) is recommended.

### Docker

```bash
docker build -t ederveengroup .
docker run -d -p 3000:3000 -v ederveengroup-data:/data -e SESSION_SECRET="$(openssl rand -hex 32)" ederveengroup
```

## Deploying for real

- **Always serve it over HTTPS** (Caddy, nginx, Cloudflare Tunnel…). `NODE_ENV=production` marks cookies `Secure`.
- Set a long random `SESSION_SECRET`. Changing it signs everyone out.
- Behind a reverse proxy, set `TRUST_PROXY=1` so login rate limiting sees real client IPs.
- Settings, signatures and contacts live in `DATA_DIR` (one JSON file per account). Back it up or mount it as a volume.

## How sessions work

IMAP and SMTP need your password for every connection, so the session cookie carries your email and password **encrypted with the server's secret key**. The browser can't read it (HttpOnly), and without the key it's useless. The server keeps no session table, so restarts don't sign anyone out. If your Purelymail password changes, the next request fails auth and you're sent back to the login page. Using a Purelymail app password lets you revoke access at any time.

## Project layout

```
server.js          Express app and JSON API
lib/session.js     Encrypted 30-day cookie sessions
lib/mail.js        IMAP pool (imapflow), message parsing, SMTP send, drafts, IDLE
lib/sanitize.js    HTML sanitizing for incoming mail and composed mail
lib/store.js       Per-user settings, signatures and contacts (JSON files)
public/            Login page and the single-page app (vanilla JS, no build step)
```
