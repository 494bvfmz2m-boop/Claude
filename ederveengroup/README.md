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
- **Two-step verification:** turn it on in Settings, then Security. Scan the QR code with any authenticator app (Google Authenticator, 1Password, Authy…). After your password, sign-in asks for the 6-digit code; you can paste it, and it submits itself. You also get 10 single-use recovery codes and an optional "trust this device for 30 days". Codes can't be replayed, and recovery codes can be regenerated.
- **Animated login:** the line artwork draws itself in, with orbiting lights, a star field that reacts to your cursor, staggered form rows, and a ring that expands from the button into the app when you sign in.
- **Profile pictures:** upload your own photo with a drag-and-zoom cropper (Settings, then Profile, or click your name in the sidebar). Colleagues who use the same EderveenGroup server see each other's photos. Other senders get their Gravatar or their company's logo, fetched and cached by your server so senders never see your IP address. You can turn sender photos off in Settings.
- **Snooze:** hide a conversation until later today, tomorrow, the weekend, next week or any time you pick, and it comes back to the Inbox as unread. Snoozes wake whenever you have EderveenGroup open (the server only holds your password inside your session cookie, so it can't act while you're away).
- **Fast triage:** quick actions appear when you hover a row (archive, snooze, read, delete), swipe right to archive and left to delete on phones, and messages are grouped by date with sticky headers.
- **Little moments:** a splash where the logo assembles itself, a welcome panel with a live clock and your counts, a time-of-day greeting, a circular reveal when switching theme, the composer flying off when you send, and gold confetti when you hit Inbox Zero.
- **Organize:** star, read/unread, archive, spam, delete (with undo), move, drag messages onto folders, multi-select (shift-click ranges), create/delete folders, empty Trash/Junk, and right-click menus.
- **Keyboard first:** `c` `/` `j` `k` `r` `a` `f` `e` `b` `#` `s` `u` `x`, a `Ctrl K` command palette, and `?` for the full list.
- **Feels instant:** messages are prefetched on hover, and folders you've visited render from cache while refreshing in the background.
- **Make it yours:** dark/light/system theme, graphite with an electric-blue accent, or any colour you pick, comfortable/compact density.
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

## Two-step verification and Purelymail

IMAP and SMTP have no way to ask for a second factor, so no mail app can show Purelymail's own 2FA prompt. If you enable 2FA in your Purelymail account, sign in here with a **Purelymail app password**, and enable EderveenGroup's two-step verification to protect this web login with your authenticator app.

## How sessions work

IMAP and SMTP need your password for every connection, so the session cookie carries your email and password **encrypted with the server's secret key**. The browser can't read it (HttpOnly), and without the key it's useless. The server keeps no session table, so restarts don't sign anyone out. If your Purelymail password changes, the next request fails auth and you're sent back to the login page. Using a Purelymail app password lets you revoke access at any time.

## Project layout

```
server.js          Express app and JSON API
lib/session.js     Encrypted 30-day cookie sessions
lib/mail.js        IMAP pool (imapflow), message parsing, SMTP send, drafts, IDLE
lib/sanitize.js    HTML sanitizing for incoming mail and composed mail
lib/store.js       Per-user settings, signatures, snoozes and contacts (JSON files)
lib/avatars.js     Uploaded profile photos plus cached Gravatar / company-logo lookups
lib/totp.js        Authenticator codes (RFC 6238) for two-step verification
public/            Login page and the single-page app (vanilla JS, no build step)
```
