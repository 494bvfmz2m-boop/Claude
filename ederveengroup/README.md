# EderveenGroup

Your own **hub of apps** on your own domain. Sign in once at `https://yourdomain/` and your apps are there:

- **Mail**: a fast, refined webmail client for **[Purelymail](https://purelymail.com)** and any other mail server you approve, over IMAP and SMTP with SSL/TLS.
- **Profile**: a contact card people can open at `https://yourdomain/profile/#/yourname` and save straight into their phone.

More apps can be added to the hub over time. Everything is stored in your MySQL/MariaDB database.

On a computer it wears **Midnight aurora**: a near-black sky with slow aurora light behind glass panels and cinematic transitions. On a phone it becomes an **Apple-style app** with a tab bar, large titles, swipe-back and sheets.

## Features

- **The hub.** `/` is the sign-in page; once you're in, it shows your apps (Mail with its unread count, Profile, and room for more). It installs as an app on Windows, Mac, Android and iPhone and opens straight on the hub, with shortcuts into Mail and Profile.
- **A username for everyone.** The first time someone signs in (Purelymail or an added mail server), they choose a username, checked live as they type, with free alternatives when a name is taken. Names are unique, and a few are reserved for the site.
- **Profile.** Write your card once (name, what you do, company, location, bio, email with a show/hide switch, phone, website, and LinkedIn, X, Instagram, GitHub, TikTok or YouTube), with a live preview. Anyone with your link gets Email/Call/Website buttons, **Save contact** (a vCard with your photo), Share and a QR code. Nothing is public until you save it, and you can make it private again at any time.
- **New-mail chime** while the app is open (Settings, then General). On iPhone it starts working after your first tap, as Safari requires.
- **Two looks, one app.** Computers get Midnight aurora (or its daytime version); phones get an iPhone-style app that's light by default, with dark or follow-the-phone in Settings, then Appearance. The aurora holds still while you scroll or type, so it never costs you smoothness.
- **A link for every screen.** Folders, conversations, searches and settings pages each have their own address, so back, forward, refresh and bookmarks work. Conversation links are opaque codes (`/mail/inbox/x7Kq2pW9aZc`), tied to your account and folder, that can't be guessed. Searches get a random code, and the words stay on your device. Opening a link while signed out brings you straight back to it after you sign in.
- **Bring your own mail server.** People whose mail isn't on Purelymail can ask for access at `/mail/request`. They fill in their IMAP and SMTP settings (auto-detected for well-known providers), and the server checks them once with their password, which is never stored. You review the request in Settings, then Admin, and accept it for that address or for their whole domain, or reject it with a reason. They get an email from your address either way, and accepted people can sign in straight away. See [Adding other mail servers](#adding-other-mail-servers).
- **Login with your Purelymail account.** Credentials are checked live against `imap.purelymail.com`.
- **Stay signed in for 30 days.** Sessions are encrypted client-side cookies (AES-256-GCM, HttpOnly, SameSite). The 30-day window slides while you keep using it. Untick "keep me signed in" for a browser-session-only login.
- **Three-pane inbox** with folders, unread badges, sender avatars, message previews and filters (Unread / Starred / Attachments). The list loads more as you scroll; there are no pages to click through.
- **Conversations.** Replies are grouped into one row (across Inbox, Sent and Archive) and open as a stack of cards, newest expanded. Reply right inside the conversation, or use **Send & archive** (`Ctrl Shift Enter`) to answer and file it in one go. Conversation view can be turned off in Settings.
- **Search operators.** `from:` `to:` `cc:` `subject:` `has:attachment` `is:unread` `is:starred` `before:2026-01-01` `after:` `larger:5M` `smaller:` and `"exact phrases"`, with hints as you type. Matches in other folders show up in a bar above the results.
- **Live new mail** via IMAP IDLE pushed to the browser with Server-Sent Events, plus desktop notifications.
- **Safe HTML email.** Messages are sanitized on the server and rendered in a script-less sandboxed iframe. Remote images (tracking pixels) are blocked until you allow them per message or per sender.
- **Rich composer** with formatting, recipient chips with contact autocomplete, Cc/Bcc, drag-and-drop attachments, reply / reply all / forward (forwarded attachments included), a "you forgot the attachment" check, and **undo send**.
- **Images in the message.** Paste a screenshot, drop a photo onto the text, or use the image button. Images are sent as proper inline parts (not links or data URLs), big photos are scaled down first, and clicking an image lets you size it S / M / L / Full or remove it.
- **Templates.** Save what you're writing as a template and insert it later from the composer; manage them in Settings, then Templates.
- **Drafts** auto-save to your Purelymail Drafts folder. Close the composer and it's saved; open a draft to keep going.
- **Signatures.** Create as many as you want with the rich editor or raw HTML, start from templates, set separate defaults for new mail and for replies, and switch while composing.
- **Two-step verification:** turn it on in Settings, then Security. Scan the QR code with any authenticator app (Google Authenticator, 1Password, Authy…). After your password, sign-in asks for the 6-digit code; you can paste it, and it submits itself. You also get 10 single-use recovery codes and an optional "trust this device for 30 days". Codes can't be replayed, and recovery codes can be regenerated.
- **Animated login and landing page:** the line artwork draws itself in, planets orbit, a comet circles the ring, stars react to your cursor, headlines reveal letter by letter, and a ring expands from the button into the app when you sign in.
- **Motion everywhere, built to stay smooth:** sliding highlights on folders, filters, settings and the command palette; opening a message morphs its subject and avatar from the list into the reader (View Transitions); the composer grows out of the button you pressed and shrinks into Drafts when saved; archived, deleted and snoozed mail flies into its folder; new mail slides in; selected avatars flip; the welcome clock's digits roll. Everything animates with transform/opacity on the GPU and respects "reduce motion".
- **In-site dialogs:** confirmations and text prompts are themed, animated dialogs instead of browser pop-ups. Destructive ones are red and focus "Cancel" by default.
- **Installable and offline-aware:** add it to your phone's home screen or install it from the browser. A service worker loads the app's own files instantly from a local cache (never your mail), shows a friendly page when you're offline, and offers a reload when a new version is deployed.
- **Devices and sign-in activity** (Settings, then Devices): see every browser that's signed in, with its device, IP address and last activity, and sign out any of them. A device you sign out is sent back to the sign-in page within seconds. Recent sign-ins are listed, failed attempts are highlighted, and you're warned if there were any this week.
- **Guided tour** on your first sign-in, and again any time from the command palette ("Take the tour").
- **Accessible:** every button has a name for screen readers, the message list works as a proper listbox with the keyboard, notifications are announced, there's a skip link, and high-contrast mode is respected.
- **Logo kit:** see [`brand/`](brand/) for the logo in SVG and PNG.
- **Profile pictures:** upload your own photo with a drag-and-zoom cropper (Settings, then Profile, or click your name in the sidebar). Colleagues who use the same EderveenGroup server see each other's photos. Other senders get their Gravatar or their company's logo, fetched and cached by your server so senders never see your IP address. You can turn sender photos off in Settings.
- **Snooze:** hide a conversation until later today, tomorrow, the weekend, next week or any time you pick, and it comes back to the Inbox as unread. Snoozes wake whenever you have EderveenGroup open (the server only holds your password inside your session cookie, so it can't act while you're away).
- **Fast triage:** quick actions appear when you hover a row (archive, snooze, read, delete), swipe right to archive and left to delete on phones, and messages are grouped by date with sticky headers.
- **Little moments:** a splash where the logo assembles itself, a welcome panel with a live clock and your counts, a time-of-day greeting, a circular reveal when switching theme, the composer flying off when you send, and gold confetti when you hit Inbox Zero.
- **Organize:** star, read/unread, archive, spam, delete (with undo), move, drag messages onto folders, multi-select (shift-click ranges), create/delete folders, empty Trash/Junk, and right-click menus.
- **Keyboard first:** `c` `/` `j` `k` `r` `a` `f` `e` `b` `#` `s` `u` `x`, a `Ctrl K` command palette, and `?` for the full list. `j` and `k` open conversations as you move when the reading pane is on; the pane can be turned off for a full-width list.
- **Feels instant:** messages are prefetched on hover, and folders you've visited render from cache while refreshing in the background.
- **Make it yours:** a theme for computers and one for phones (dark, light or system), an electric-blue accent or any colour you pick, and comfortable or compact density.
- View original source, download `.eml`, print, and one-click unsubscribe.

## Run it (no commands needed)

The release zip includes everything, so you don't need `npm install` or a config file.

1. Install **[Node.js](https://nodejs.org)** (free, the LTS version) once.
2. Extract the zip.
3. Double-click the launcher for your system:
   - **Windows:** `Start EderveenGroup (Windows).bat`
   - **Mac:** `Start EderveenGroup (Mac).command` (the first time, right-click it and choose **Open**)
   - **Linux / a server:** `./start.sh`
4. Your browser opens **http://localhost:3000/**. Sign in with your email address and choose a username.

The hub is at `/`, Mail at **`/mail`** and Profile at **`/profile`**. Without database settings, everything is kept in the `data/` folder, which is handy for trying it out. For real use, add your database (see [Database](#database)).

A secret key is created automatically in `data/session.key` on first start. **Keep the `data/` folder (or set `SESSION_SECRET`)**: the key signs everyone in, and it also encrypts the private account data in the database. Without it, nobody can sign in and that data can't be read.

### Putting it on mydomain.net

It needs a machine that can run Node.js (a VPS, a home server, or a host with Node.js support). It won't run on PHP-only shared hosting.

1. Copy the extracted folder to the server and start it with `./start.sh`. To keep it running after you log out, use a service manager such as systemd or pm2.
2. Install [Caddy](https://caddyserver.com) for free automatic HTTPS. Rename `Caddyfile.example` to `Caddyfile`, put in your domain, and run `caddy run`.
3. Point your domain's DNS at the server. Visitors get the sign-in and hub at `https://mydomain.net/`, mail at `https://mydomain.net/mail/` and profiles at `https://mydomain.net/profile/`.

Cookies are marked `Secure` automatically behind HTTPS.

**cPanel hosts with "Setup Node.js App":** create an app with startup file `server.js` and application URL set to your domain, then restart it.

### Coolify

Add these under your application → **Environment Variables**, then redeploy:

| Variable | Value |
| --- | --- |
| `DB_HOST` | your database server, e.g. `162.0.217.46` |
| `DB_NAME` | the database name |
| `DB_USER` | the database user |
| `DB_PASSWORD` | the database password |
| `ADMIN_EMAILS` | your email address (more than one: separate with commas). Gives you **Settings → Admin** |

Optional: `DB_PORT` (default 3306), `DB_SSL=1` if your database supports encrypted connections.

1. Point your domain's DNS `A` record at the server, and open ports 80 and 443.
2. In Coolify: **+ New → Application**, then pick this GitHub repository and branch.
3. **Build Pack:** Dockerfile · **Base Directory:** `/` (the default; `/ederveengroup` works too) · **Ports Exposes:** `3000` · **Domains:** `https://mydomain.net`
4. **Persistent Storage → Volume** mounted at **`/data`** (keeps sign-ins, settings, photos and 2FA across deploys).
5. Deploy. No environment variables are needed: the image runs as a non-root user, trusts Coolify's proxy (`TRUST_PROXY=1`) and has a health check.

### Docker

```bash
docker build -t ederveengroup .
docker run -d -p 3000:3000 -v ederveengroup-data:/data -e TRUST_PROXY=loopback ederveengroup
```

### Building the release zip (developers)

```bash
npm run release
```

This packages the last commit with production dependencies into `ederveengroup.zip`.

## Database

EderveenGroup keeps everything in MySQL or MariaDB when `DB_HOST` is set: accounts and settings, usernames, profiles, profile photos, and the list of added mail servers. On first start it creates three tables (`eg_users`, `eg_photos`, `eg_registry`) in the database you give it; there's nothing to import by hand.

- **Private data is encrypted** before it's stored (AES-256-GCM): settings, signatures, two-step verification, signed-in devices, sign-in history, contacts and snoozes. The database host only ever sees ciphertext for these. Usernames and public profiles are stored readable, because they are public anyway.
- **Moving over is automatic.** If the app ran before with files in `data/`, each account, photo and the mail-server list is copied into the database the first time it's used.
- **If the database can't be reached**, every page says so and the app keeps retrying every 10 seconds.

**Shared hosting (cPanel, e.g. Namecheap):** the database only accepts connections from addresses you allow. In cPanel, open **Remote MySQL** (or "Remote Database Access"), add your VPS's public IP address as an access host, and save. Then fill in the `DB_*` variables above. Database names and users on cPanel usually carry your account prefix (`cpaneluser_name`).

## Adding other mail servers

1. Set `ADMIN_EMAILS` to your address (see Coolify above, or put `ADMIN_EMAILS=you@yourdomain.com` in a `.env` file next to `server.js`).
2. Share `https://yourdomain/mail/request`. The sign-in page links to it too ("Mail somewhere else?").
3. Requests appear in **Settings → Admin**, and admins get a notice when they sign in. Each shows the servers and whether the settings worked. Choose **Only this address** or **Everyone @theirdomain**, then **Accept** or **Reject**.
4. The requester gets an email from your mailbox. Accepted addresses sign in at the normal sign-in page and use their own servers; everyone else keeps using Purelymail.

To keep this safe, the request form only connects to public mail servers on the standard encrypted ports (IMAP 993/143, SMTP 465/587), never to your own network. It is rate-limited, and the password is used once and thrown away. Remove an added server in the same Admin page.

Notes: Gmail and iCloud need an app password. Outlook.com and Microsoft 365 no longer allow password sign-in over IMAP, so they can't be added.

## Two-step verification and Purelymail

IMAP and SMTP have no way to ask for a second factor, so no mail app can show Purelymail's own 2FA prompt. If you enable 2FA in your Purelymail account, sign in here with a **Purelymail app password**, and enable EderveenGroup's two-step verification to protect this web login with your authenticator app.

## Security

- Encrypted, HttpOnly, SameSite session cookies for the whole site, marked Secure automatically when served over HTTPS
- Every sign-in is tracked per device: sign out one device, all others, or everything (Settings, then Devices / Account). Turning on 2FA ends all other sessions too.
- A log of recent sign-ins, including failed passwords and 2FA codes (only for accounts that have signed in here before, so random attempts can't create files)
- Brute-force protection per IP and per account, plus a separate limit on 2FA code guesses
- CSRF protection: a custom header plus an Origin check on every state-changing request
- Responses are compressed, and static files are versioned per deploy and cached for a year
- The service worker only caches the app's own versioned files; mail and anything under `/api/` is never stored on the device
- Strict Content-Security-Policy, HSTS over HTTPS, no framing, locked-down Permissions-Policy, cross-origin isolation
- Incoming mail is sanitized server-side and rendered in a script-less sandbox; remote images are blocked by default
- Sender photos are fetched by the server, so senders never see your IP
- 2FA codes can't be replayed; recovery codes are single-use and stored hashed
- The data folder is readable only by the user running the app

## How sessions work

IMAP and SMTP need your password for every connection, so the session cookie carries your email and password **encrypted with the server's secret key**. The browser can't read it (HttpOnly), and without the key it's useless. The server separately keeps a small list of active sessions per account (a random id, the device and IP, and when it was last used; never the password), stored encrypted in the database, so you can see and revoke devices and restarts don't sign anyone out. If your Purelymail password changes, the next request fails auth and you're sent back to the login page. Using a Purelymail app password lets you revoke access at any time.

## Project layout

```
server.js          Entry point: loads config and starts the app
src/               The app: config, security, pages, settings validation, 2FA, devices, profiles,
                   routes/ (hub = site-wide API for usernames and Profile; auth, twofa, account, mail, events, servers)
lib/session.js     Encrypted 30-day cookie sessions
lib/mail.js        IMAP pool (imapflow), message parsing, conversations, SMTP send, drafts, IDLE
lib/query.js       Search box operators (from:, has:attachment, before: …) to IMAP SEARCH
lib/links.js       Opaque per-account conversation links
lib/db.js          Storage: MySQL/MariaDB (or files without a database), encryption of private data, migration
lib/usernames.js   Username rules, reserved names, suggestions
lib/servers.js     Other mail servers: validation, public-address checks, one-time test, auto-detect
lib/sanitize.js    HTML sanitizing for incoming mail and composed mail
lib/store.js       Per-user settings, signatures, templates, snoozes, contacts, sessions and sign-in activity (JSON files)
lib/avatars.js     Uploaded profile photos plus cached Gravatar / company-logo lookups
lib/totp.js        Authenticator codes (RFC 6238) for two-step verification
views/             Pages: hub, sign-in, username step, Profile, Mail app, request form, not-found (+ partials/),
                   and sw.js, the service worker template (rendered per deploy)
brand/             Logo kit (generated by scripts/brand/make_logo.py)
public/            Styles, icons and scripts (vanilla JS, no build step)
public/css/        app.css (shared), desk.css (computers: Midnight aurora), phone.css (phones: Apple-style)
public/js/app/     The webmail client as ES modules (main.js boots it; router.js = addresses, phone.js = phone app)
tests/             npm test: unit + HTTP integration tests (no mail server needed)
Start EderveenGroup (Windows).bat / (Mac).command / start.sh   Double-click launchers
```
