# EderveenGroup

Your own **hub of apps** on your own domain. Sign in once at `https://yourdomain/` and your apps are there:

- **Mail**: a fast, refined webmail client for **[Purelymail](https://purelymail.com)**, Gmail, Outlook.com, Microsoft 365 and any other mail server you approve, over IMAP and SMTP with SSL/TLS.
- **Profile**: a contact card people can open at `https://yourdomain/profile/#/yourname` and save straight into their phone.
- **Notes**: quick private notes, saved as you type.
- **Tasks**: a to-do list with Today, Tomorrow and due dates.
- **Contacts**: your own address book, plus everyone on EderveenGroup with a public card.
- **Admin** (only for the addresses in `ADMIN_EMAILS`): requests, people, and who may sign in.

People sign in with their mail password, or with **Sign in with Microsoft** / **Sign in with Google**. Everything is stored in your MySQL/MariaDB database.

On a computer it wears **Midnight aurora**: a near-black sky with slow aurora light behind glass panels and cinematic transitions. On a phone it becomes an **Apple-style app** with a tab bar, large titles, swipe-back and sheets.

## Features

- **The hub.** `/` is the sign-in page; once you're in, it shows your apps (Mail with its unread count, Profile, Notes, Tasks, Contacts, and Admin for admins). It installs as an app on Windows, Mac, Android and iPhone and opens straight on the hub, with shortcuts into Mail, Notes, Tasks and Profile. Every app has a way back to the hub: the logo or **Apps** at the top, the grid button in Mail's sidebar, or the **Apps** tab on a phone.
- **Sign in with Microsoft or Google.** Buttons on the sign-in page send people to Microsoft's or Google's own sign-in page, and Mail then reads and sends their Outlook.com, Hotmail, Microsoft 365 or Gmail mail with a token instead of a password (IMAP and SMTP with XOAUTH2). Nobody's Microsoft or Google password ever reaches your server. New addresses wait for an admin's approval unless you choose "anyone" in Admin. See [Sign in with Microsoft and Google](#sign-in-with-microsoft-and-google).
- **Admin app** at `/admin/` for the addresses in `ADMIN_EMAILS`: an overview, requests to add a mail server or to sign in with Microsoft/Google (accept for one address or a whole domain, or reject with a reason; the person is emailed either way), everyone who has signed in (sign them out everywhere, or hide a profile card), and who may sign in with Microsoft or Google.
- **Notes.** Private notes that save as you type, with a title, colour labels, pinning, search, and undo when you delete one. On a phone a note opens full screen.
- **Tasks.** Add a task and tap Today, Tomorrow or pick a date. Tasks are grouped into Overdue, Today, Upcoming and Someday; star the important ones, click a task to rename it, tick it off (with undo), and find finished ones under Completed.
- **Contacts.** Your own address book (name, up to four email addresses, phone, company, EderveenGroup username and a note), with favourites, A–Z, search, **Add people I've emailed** (from the people Mail has seen you write to and hear from), and **Export (.vcf)** for your phone or another mail app. The **EderveenGroup** tab lists everyone with a public card. Email and Call buttons open a new message in Mail or your phone's dialler.
- **A username for everyone.** The first time someone signs in (Purelymail or an added mail server), they choose a username, checked live as they type, with free alternatives when a name is taken. Names are unique, and a few are reserved for the site.
- **Profile.** Write your card once (name, what you do, company, location, bio, email with a show/hide switch, phone, website, and LinkedIn, X, Instagram, GitHub, TikTok or YouTube), with a live preview. The card can use your Mail photo, its own photo, or none. Anyone with your link gets Email/Call/Website buttons, **Save contact** (a vCard with your photo), Share and a QR code. Nothing is public until you save it, and you can make it private again at any time.
- **New-mail chime** while the app is open (Settings, then General). On iPhone it starts working after your first tap, as Safari requires.
- **Two looks, one app.** Computers get Midnight aurora (or its daytime version); phones get an iPhone-style app that's light by default, with dark or follow-the-phone in Settings, then Appearance. The aurora holds still while you scroll or type, so it never costs you smoothness.
- **A link for every screen.** Folders, conversations, searches and settings pages each have their own address, so back, forward, refresh and bookmarks work. Conversation links are opaque codes (`/mail/inbox/x7Kq2pW9aZc`), tied to your account and folder, that can't be guessed. Searches get a random code, and the words stay on your device. Opening a link while signed out brings you straight back to it after you sign in.
- **Bring your own mail server.** People whose mail isn't on Purelymail can ask for access at `/mail/request`. They fill in their IMAP and SMTP settings (auto-detected for well-known providers), and the server checks them once with their password, which is never stored. Gmail and Microsoft addresses are pointed to Sign in with Google / Microsoft instead. You review the request in the Admin app, and accept it for that address or for their whole domain, or reject it with a reason. They get an email from your address either way, and accepted people can sign in straight away. See [Adding other mail servers](#adding-other-mail-servers).
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

**Database (recommended): run it on the same server.** In Coolify: **+ New → Database → MariaDB**, start it, open its **General** settings and copy the **Internal URL** (`mysql://…`). In your EderveenGroup application → **Environment Variables**, add `DATABASE_URL` with that value, plus `ADMIN_EMAILS` with your address, and redeploy. Nothing is exposed to the internet and nothing has to be allowed in a hosting panel.

**Or use a database somewhere else** (for example on shared hosting). That host must allow your server's IP (in cPanel: **Remote Database Access**, called **Remote MySQL** in older versions). Add these under your application → **Environment Variables**, then redeploy:

| Variable | Value |
| --- | --- |
| `DB_HOST` | your database server's address, e.g. `203.0.113.10` |
| `DB_NAME` | the database name |
| `DB_USER` | the database user |
| `DB_PASSWORD` | the database password |
| `ADMIN_EMAILS` | your email address (more than one: separate with commas). Gives you the **Admin** app |

Optional: `DB_PORT` (default 3306), `DB_SSL=1` if your database supports encrypted connections. For **Sign in with Microsoft / Google**, add the variables in [that section](#sign-in-with-microsoft-and-google).

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

- **Private data is encrypted** before it's stored (AES-256-GCM): settings, signatures, two-step verification, signed-in devices, sign-in history, contacts, snoozes, Microsoft/Google sign-in tokens, and everything in Notes, Tasks and Contacts. The database host only ever sees ciphertext for these. Usernames and public profiles are stored readable, because they are public anyway.
- **Moving over is automatic.** If the app ran before with files in `data/`, each account, photo and the mail-server list is copied into the database the first time it's used.
- **If the database can't be reached**, every page says so and the app keeps retrying every 10 seconds.

**Shared hosting (cPanel, e.g. Namecheap):** the database only accepts connections from addresses you allow. In cPanel, open **Remote MySQL** (or "Remote Database Access"), add your VPS's public IP address as an access host, and save. Then fill in the `DB_*` variables above. Database names and users on cPanel usually carry your account prefix (`cpaneluser_name`).

## Adding other mail servers

1. Set `ADMIN_EMAILS` to your address (see Coolify above, or put `ADMIN_EMAILS=you@yourdomain.com` in a `.env` file next to `server.js`).
2. Share `https://yourdomain/mail/request`. The sign-in page links to it too ("Mail somewhere else?").
3. Requests appear in the **Admin** app (`/admin/`, also on the hub), and admins get a notice when they sign in. Each shows the servers and whether the settings worked. Choose **Only this address** or **Everyone @theirdomain**, then **Accept** or **Reject**.
4. The requester gets an email from your mailbox. Accepted addresses sign in at the normal sign-in page and use their own servers; everyone else keeps using Purelymail.

To keep this safe, the request form only connects to public mail servers on the standard encrypted ports (IMAP 993/143, SMTP 465/587), never to your own network. It is rate-limited, and the password is used once and thrown away. Remove an added server in Admin, then Access.

Notes: iCloud and other providers that use app passwords work here with an app password. For Gmail, Outlook.com, Hotmail and Microsoft 365, use [Sign in with Microsoft and Google](#sign-in-with-microsoft-and-google) instead: Microsoft no longer allows passwords over IMAP at all.

## Sign in with Microsoft and Google

With this turned on, the sign-in page shows **Sign in with Microsoft** and **Sign in with Google**. People sign in on Microsoft's or Google's own page, agree to let EderveenGroup use their mail, and land in the hub. Mail then uses a token for IMAP and SMTP; the server renews it by itself, and it's stored encrypted with the rest of the account. Each button only appears once its two variables are set.

**Who may use it:** admins always can. Anyone else's first sign-in becomes a request in the Admin app, and they're emailed when you accept it (for that address or their whole domain). In Admin, then Access, you can allow addresses or domains in advance, or switch from **Only approved** to **Anyone**.

### Microsoft (Outlook.com, Hotmail, Live and Microsoft 365)

1. Go to the [Microsoft Entra admin center](https://entra.microsoft.com) (any Microsoft account works) → **App registrations** → **New registration**.
2. Name: `EderveenGroup`. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**. Redirect URI: platform **Web**, `https://yourdomain/auth/microsoft/callback`. Register.
3. Copy the **Application (client) ID**. Then **Certificates & secrets → New client secret**, and copy its **Value** (not the Secret ID). Note when it expires and make a new one before then.
4. **API permissions → Add a permission → Microsoft Graph → Delegated permissions**: tick `offline_access`, `openid`, `email`, `profile`, `IMAP.AccessAsUser.All` and `SMTP.Send`, then **Add permissions**.
5. Add the environment variables `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`, and redeploy.

Good to know:
- **Outlook.com / Hotmail** users must have IMAP turned on: Outlook.com → Settings → Mail → **Forwarding and IMAP** → **Let devices and apps use IMAP**. If it's off, the sign-in page tells them exactly that.
- **Microsoft 365 (work or school)** organisations must allow IMAP and **Authenticated SMTP** for their mailboxes, and their admin may have to approve the app once (they'll see a consent screen).
- To allow only your own Microsoft 365 organisation, set `MICROSOFT_TENANT` to your tenant ID or domain, and choose "Accounts in this organizational directory only" in step 2.

### Google (Gmail and Google Workspace)

1. In the [Google Cloud console](https://console.cloud.google.com), create a project, open **APIs & Services → Library** and enable the **Gmail API**.
2. **OAuth consent screen** (Google Auth Platform): user type **External**, fill in the app name, support email and your domain. Under **Data access**, add the scopes `openid`, `email`, `profile` and `https://mail.google.com/`.
3. **Credentials → Create credentials → OAuth client ID**: type **Web application**, authorised redirect URI `https://yourdomain/auth/google/callback`. Copy the client ID and secret.
4. Add the environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and redeploy.

Good to know: `https://mail.google.com/` is a *restricted* scope. While the app is in **Testing**, only the up to 100 test users you list on the consent screen can sign in, and Google makes them sign in again every 7 days. To open it to everyone, Google requires its app verification and a yearly security assessment. For a family or a small team, Testing mode with a list of test users works fine. A Google Workspace domain can instead make the app **Internal** for its own users.

| Variable | Value |
| --- | --- |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | from step 3 above |
| `MICROSOFT_TENANT` | optional: `common` (default), or your organisation's tenant ID/domain |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from step 3 above |
| `PUBLIC_URL` | optional: `https://yourdomain`, if the redirect address comes out wrong behind your proxy |

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

IMAP and SMTP need your password for every connection, so the session cookie carries your email and password **encrypted with the server's secret key**. (People who use Sign in with Microsoft or Google have no password in their cookie at all, only which of the two they used; their tokens are kept encrypted with their account.) The browser can't read it (HttpOnly), and without the key it's useless. The server separately keeps a small list of active sessions per account (a random id, the device and IP, and when it was last used; never the password), stored encrypted in the database, so you can see and revoke devices and restarts don't sign anyone out. If your Purelymail password changes, the next request fails auth and you're sent back to the login page. Using a Purelymail app password lets you revoke access at any time.

## Project layout

```
server.js          Entry point: loads config and starts the app
src/               The app: config, security, pages, settings validation, 2FA, devices, profiles,
                   routes/ (hub = site-wide API for usernames and Profile; apps = Notes/Tasks/Contacts;
                   oauth = Sign in with Microsoft/Google; servers = requests and the Admin API;
                   auth, twofa, account, mail, events)
lib/session.js     Encrypted 30-day cookie sessions
lib/oauth.js       Sign in with Microsoft / Google (OAuth 2.0 + PKCE), token renewal, their mail servers
lib/mail.js        IMAP pool (imapflow), message parsing, conversations, SMTP send, drafts, IDLE
lib/query.js       Search box operators (from:, has:attachment, before: …) to IMAP SEARCH
lib/links.js       Opaque per-account conversation links
lib/db.js          Storage: MySQL/MariaDB (or files without a database), encryption of private data, migration
lib/usernames.js   Username rules, reserved names, suggestions
lib/servers.js     Other mail servers: validation, public-address checks, one-time test, auto-detect
lib/sanitize.js    HTML sanitizing for incoming mail and composed mail
lib/store.js       Per-user settings, signatures, templates, snoozes, contacts, sessions, sign-in activity, tokens and app data
lib/avatars.js     Uploaded profile photos plus cached Gravatar / company-logo lookups
lib/totp.js        Authenticator codes (RFC 6238) for two-step verification
views/             Pages: hub, sign-in, username step, Profile, Notes, Tasks, Contacts, Admin, Mail app, request form,
                   not-found (+ partials/),
                   and sw.js, the service worker template (rendered per deploy)
brand/             Logo kit (generated by scripts/brand/make_logo.py)
public/            Styles, icons and scripts (vanilla JS, no build step)
public/css/        app.css (shared), desk.css (computers: Midnight aurora), phone.css (phones: Apple-style)
public/js/app/     The webmail client as ES modules (main.js boots it; router.js = addresses, phone.js = phone app)
public/js/         hub.js, login.js, profile.js, admin.js, and notes.js / tasks.js / contacts.js on top of kit.js
tests/             npm test: unit + HTTP integration tests (no mail server needed)
Start EderveenGroup (Windows).bat / (Mac).command / start.sh   Double-click launchers
```
