# EderveenGroup

Your own **hub of apps** on your own domain. Sign in once at `https://yourdomain/` and your apps are there:

Your apps, grouped on the dashboard:

- **Communicate:** **Mail** (a fast, refined webmail client for **[Purelymail](https://purelymail.com)**, Gmail, Outlook.com, Microsoft 365 and any other mail server you approve), **Chat** (talk with people on EderveenGroup, one to one or in groups, live) and **Contacts** (your address book, plus everyone on EderveenGroup with a public card).
- **Plan:** **Calendar** (appointments and deadlines, also on your phone's calendar), **Tasks** (to-dos with due dates) and **Planner** (boards of cards for projects, like Microsoft Planner or Trello).
- **Create:** **Notes**, **Whiteboard** (draw and sketch together), and an office suite: **Docs** (like Word), **Spreadsheets** (like Excel), **Slides** (like PowerPoint) and **Forms** (like Microsoft Forms). They download as .docx, .xlsx, .pptx, CSV or PDF, and open Word, Excel, CSV and PowerPoint files.
- **Store:** **Files** (your own cloud drive, also as a network drive on your computer and phone) and **Photos** (every photo and video by the day it was taken).
- **You:** **Profile** (a contact card people open at `https://yourdomain/profile/#/yourname`) and **Admin** (for the addresses in `ADMIN_EMAILS`).

People sign in with their mail password, or with **Sign in with Microsoft** / **Sign in with Google**. Accounts and app data live in your MySQL/MariaDB database; files and photos in a folder on disk that can be as big as you like.

On a computer it wears **Midnight aurora**: a near-black sky with slow aurora light behind glass panels and cinematic transitions. On a phone it becomes an **Apple-style app** with a tab bar, large titles, swipe-back and sheets.

## Features

- **The dashboard.** `/` is the sign-in page; once you're in, it shows today at a glance (your events, tasks that are due with a tick box, the latest unread mail, and News from the admins), quick buttons for a new message, event, task, note or doc, and every app by category with its own icon and a live line (unread, due today, how many files…). It installs as an app on Windows, Mac, Android and iPhone and opens on the dashboard, with shortcuts into Mail, Calendar, Tasks and Files. Every app has a way back: the logo or **Apps** at the top, the grid button in Mail's sidebar, or the **Apps** tab on a phone.
- **Sign in with Microsoft or Google.** Buttons on the sign-in page send people to Microsoft's or Google's own sign-in page, and Mail then reads and sends their Outlook.com, Hotmail, Microsoft 365 or Gmail mail with a token instead of a password (IMAP and SMTP with XOAUTH2). Nobody's Microsoft or Google password ever reaches your server. New addresses wait for an admin's approval unless you choose "anyone" in Admin. See [Sign in with Microsoft and Google](#sign-in-with-microsoft-and-google).
- **Admin app** at `/admin/` for the addresses in `ADMIN_EMAILS`: an overview with recent activity (sent with the page itself, so Admin is never empty even if its script is blocked); requests to add a mail server or to sign in with Microsoft/Google (accept for one address or a whole domain, or reject with a reason; the person is emailed either way); People (make someone an admin, block an account, sign them out everywhere, hide a profile card); Access (who may sign in with Microsoft or Google); Sign-in (switch on Microsoft and Google by pasting the keys, with step-by-step instructions); Activity (every sign-in on the site, good or failed, and every admin change); News (posts on everyone's dashboard); and Apps (switch apps off for everyone).
- **Notes.** Private notes that save as you type, with a title, colour labels, pinning, search, and undo when you delete one. On a phone a note opens full screen.
- **Tasks.** Add a task and tap Today, Tomorrow or pick a date. Tasks are grouped into Overdue, Today, Upcoming and Someday; star the important ones, click a task to rename it, tick it off (with undo), and find finished ones under Completed.
- **Contacts.** Your own address book (name, up to four email addresses, phone, company, EderveenGroup username and a note), with favourites, A–Z, search, **Add people I've emailed** (from the people Mail has seen you write to and hear from), and **Export (.vcf)** for your phone or another mail app. The **EderveenGroup** tab lists everyone with a public card. Email and Call buttons open a new message in Mail or your phone's dialler.
- **Calendar.** Month view with the day beside it (a compact month with dots on a phone), an agenda of what's coming, and events that last all day or several days, repeat (daily, weekdays, weekly, monthly, yearly, until a date), with a place, notes and a colour. **On your phone:** Calendar gives you a private address to add as a subscribed calendar on iPhone, Google Calendar or Outlook, so your events show up there and stay up to date. **Shared calendars:** under **Calendars**, paste a webcal or iCal link (your Magister agenda link, Google Calendar's “Secret address in iCal format” or a public share link, an Outlook ICS link, an iCloud public calendar) and its events appear next to yours in their own colour, also on the dashboard, refreshed every half hour; hide, rename, recolour or remove it any time. Repeating events, exceptions and time zones are worked out by the server, which only fetches from public internet addresses.
- **Files: your own cloud drive.** Folders, uploads of any size (big ones go up in parts and carry on after a dropped connection), previews, share links that work without signing in, search across folders, and a meter of the room left. Files can also be a **network drive**: see [Your own cloud](#your-own-cloud-files-photos-and-a-network-drive).
- **Photos.** Every photo and video from Files, by month, using the date the camera recorded; albums (your folders), a full-screen viewer with swipe and arrow keys, videos that play and seek, share links. Add photos from your phone's camera roll, or let a sync app back them up by itself.
- **Docs, like Word.** A real page (A4 or Letter, portrait or landscape, normal/narrow/wide margins) with a ribbon: fonts and sizes, bold/italic/underline/strikethrough, sub- and superscript, text colour and highlight, bullets, numbering, checklists, indents, alignment, styles (Normal, Heading 1–3, Quote, Code), tables (pick the size, add or remove rows and columns), pictures (resize and align), links, lines, page breaks and the date; zoom, page and word count. Saved as you type. Keep a doc private or share it (to read, or to edit too); shared docs are your knowledge base. **Download as Word (.docx) or PDF**, or HTML; **open Word files** (.docx) to carry on here.
- **Spreadsheets, like Excel.** A grid with a name box and formula bar, several sheets, and about 70 functions (SUM, AVERAGE, IF, VLOOKUP, SUMIF, COUNTIF, ROUND, TODAY, TEXT…, also with Dutch names and `;` like Excel in Dutch). AutoSum, fill handle, copy and paste with Excel, sort, insert and delete rows and columns, freeze the top row, column widths, bold/italic/colours/fill, number formats (number, € currency, percent, date, text) and the sum/average/count of a selection. **Download as Excel (.xlsx)** with working formulas, **CSV** or **PDF**; **open .xlsx and .csv files**.
- **Slides, like PowerPoint.** A ribbon (Home, Insert, Design, Transitions, Slide Show), the slide pane with drag to reorder and a right-click menu, eight layouts (Title Slide, Title and Content, Section Header, Two Content, Title Only, Big Statement, Picture with Caption, Blank) with “Click to add…” placeholders and text that shrinks to fit, bullet levels (Tab / Shift+Tab), text boxes, shapes and pictures you drag, resize and layer, fonts, sizes, colours and alignment, eight themes, slide backgrounds, transitions, speaker notes, slide sorter, undo/redo and PowerPoint's shortcuts (F5, Shift+F5, Ctrl+M, Ctrl+D). The full-screen slide show has the transitions, B/W for a black or white screen, a slide number + Enter to jump, and an end screen. **Download as PowerPoint (.pptx)** (backgrounds, notes and transitions included) or **PDF**; **open PowerPoint files** (.pptx), and a deck downloaded from here comes back with its layouts and theme.
- **Forms, like Microsoft Forms.** Build a form from scratch or a template (event sign-up, feedback, poll, contact details) with choice, checkboxes, dropdown, short and long text, rating, scale, date, time, email, number and sections; required questions and an “Other” answer. **Send** gives you a link (`https://yourdomain/r/…`) and a QR code: anyone can fill it in without an account, or only signed-in people (then you see who answered, and can allow one response each). See the answers as bar charts, averages and lists, or one by one; **download them as Excel (.xlsx) or CSV**, or open them in Spreadsheets. Close a form any time; answers are checked on the server and rate-limited, and a hidden field catches robots.
- **Chat, like Teams chat.** Talk with anyone on EderveenGroup, one to one or in a named group. Messages arrive live, with “… is typing”, “Seen”, pictures (paste or pick one), replies, reactions, editing (↑ in an empty box edits your last one) and deleting your own; links work and emoji-only messages show big. Groups can be renamed, and people added or leave. Unread counts show on the dashboard, and Chat can give a notice for new messages while it's open in the background. On a phone the list and the conversation are two screens, with a long press for a message's menu.
- **Planner, like Microsoft Planner or Trello.** Boards with columns (start blank, or from a project, week planner or trip) and cards you drag from column to column, also with a long press on a phone. A card has labels (named per board), a due date (late, today and soon stand out), people on it, notes and a checklist; dropping it in Done marks it done. Filter cards or show only yours, pick a background, and share a board to plan together. The dashboard shows what's due for you this week.
- **Whiteboard.** An endless canvas with pen, highlighter, eraser, lines, arrows, rectangles, circles, text and sticky notes; select, move, resize, duplicate and undo; pan and zoom (pinch on a phone). Share a whiteboard to draw on it together, and download it as PNG or SVG.
- **Photo Editor.** Open a photo from your device, from Files, or with the pencil button in Photos. **Adjust** light and colour (exposure, contrast, highlights, shadows, saturation, vibrance, warmth, tint, fade, vignette, sharpen, blur, grain, with a one-tap Auto), pick one of 14 **Looks**, add **Effects** (glitch, pixelate, sepia, invert…), **Crop** to a shape, rotate, flip and straighten, and add **text** (fonts, colours, outline/box styles), **stickers** and **drawing**. Everything runs on the graphics card, so sliders are live even on a phone. Undo/redo, hold **Before** to compare, then download a full-size JPEG, PNG or WebP, or save it to Files → Edited photos.
- **Video Editor, like CapCut.** Make a project in 16:9, 9:16 (TikTok, Reels, Shorts), 1:1 or 4:5 and import videos, photos and music (they're kept in Files → Video Editor, so a project opens on any device). On the timeline you drag clips to reorder them, drag their ends to trim, split at the playhead (S), add a **freeze frame** (F), copy and delete, change speed (0.25× to 4×) and volume, and choose Fill or Fit. Place each clip in the frame with **size, position, rotation, mirror and flip** (or drag the picture on the video), on a blurred, black, white or coloured background, and **fade** it in and out. Each clip gets the Photo Editor's looks and adjustments, plus **27 effects** (zoom, slow zoom, pans, pulse, heartbeat, shake, earthquake, wobble, spin in, glitch, VHS, RGB split, old film, pixel in, flash, strobe, invert flash, black & white, colour in, dream, rainbow, blur in/out) and one of **21 transitions** into the next clip (fade, dip to black or white, flash, slides in four directions, cover, zoom in/out, spin, wipes, diagonal, circle, split, blur, whip pan, glitch, pixelate). Add titles and captions in 9 styles (shadow, outline, box, title, neon, highlight, retro, gradient…) with 11 animations (fade, pop, slide, drop, bounce, zoom, typewriter, wave, blur in, flicker…), and music with fade in/out. **Export** plays the edit once while recording it into a 1080p or 720p video file (MP4 where the browser can make one, otherwise WebM) to download or save to Files. Projects can be duplicated, cleared (**Clear timeline**, with Undo) or deleted (the footage stays in Files), and shared like docs.
- **Auto edit with AI (admins).** Admins get an **Auto edit** button in the Video Editor and an **AI edit** tool in the Photo Editor. For a video, the AI looks at frames from every clip, how loud each second is (cheering, laughter, speech) and the beat of your music, then builds the whole edit from your brief (“a fast 30-second recap of our holiday for Instagram, with a title”): the best moments, their order and speed, looks, effects, transitions, titles and the music, cut to the beat. You can change anything afterwards, and Undo takes it all back. For a photo it chooses the adjustments, a look, a crop and straightening. It runs on your own API key: Claude by default, or Gemini, Groq, OpenAI, OpenRouter, Mistral, Grok or any OpenAI-compatible service (also Ollama or LM Studio on your own computer); see [Auto editing with AI](#auto-editing-with-ai).
- **Undo and redo everywhere.** Ctrl Z (⌘ Z) undoes and Ctrl Y or Ctrl Shift Z redoes in Docs, Spreadsheets, Slides, Forms, Planner, Whiteboard and both editors, also right after you moved a slider or picked from a menu. In a text box they undo your typing, as usual.
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

Optional: `DB_PORT` (default 3306), `DB_SSL=1` if your database supports encrypted connections. **Sign in with Microsoft / Google** is easiest to switch on in the Admin app (Admin, then Sign-in), or with the variables in [that section](#sign-in-with-microsoft-and-google). For where Files and Photos keep their contents, see [Your own cloud](#your-own-cloud-files-photos-and-a-network-drive).

1. Point your domain's DNS `A` record at the server, and open ports 80 and 443.
2. In Coolify: **+ New → Application**, then pick this GitHub repository and branch.
3. **Build Pack:** Dockerfile · **Base Directory:** `/` (the default; `/ederveengroup` works too) · **Ports Exposes:** `3000` · **Domains:** `https://mydomain.net`
4. **Persistent Storage → Volume** mounted at **`/data`** (keeps sign-ins, settings, photos and 2FA across deploys).
5. Deploy. No environment variables are needed: the image runs as a non-root user, trusts Coolify's proxy (`TRUST_PROXY=1`) and has a health check.

**After an update:** use **Redeploy** (not Restart, which keeps the old code). The version at the bottom of the dashboard and in Admin (for example *Version 2026.11.5*) shows which release is live.

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

- **Private data is encrypted** before it's stored (AES-256-GCM): settings, signatures, two-step verification, signed-in devices, sign-in history, contacts, snoozes, Microsoft/Google sign-in tokens, everything in Notes, Tasks, Contacts and Calendar, Docs, Spreadsheets, Slides, Forms (with their responses), Chat, Planner and Whiteboard, News and the activity log. File contents (Files, Photos) live encrypted on disk, see [Your own cloud](#your-own-cloud-files-photos-and-a-network-drive). The database host only ever sees ciphertext for these. Usernames and public profiles are stored readable, because they are public anyway.
- **Moving over is automatic.** If the app ran before with files in `data/`, each account, photo and the mail-server list is copied into the database the first time it's used.
- **If the database can't be reached**, every page says so and the app keeps retrying every 10 seconds.

**Shared hosting (cPanel, e.g. Namecheap):** the database only accepts connections from addresses you allow. In cPanel, open **Remote MySQL** (or "Remote Database Access"), add your VPS's public IP address as an access host, and save. Then fill in the `DB_*` variables above. Database names and users on cPanel usually carry your account prefix (`cpaneluser_name`).

## Your own cloud: Files, Photos and a network drive

Files and Photos keep what you upload in a folder on disk, encrypted, not in the database. That folder is `FILES_DIR` (default: `files` inside the data folder, so `/data/files` in Docker and Coolify). Give it as much room as you like:

| Variable | Value |
| --- | --- |
| `FILES_DIR` | where file contents are kept, e.g. `/storage/ederveengroup` |
| `FILES_QUOTA_MB` | optional: room per person in MB (default: no limit but the disk) |
| `FILES_MAX_MB` | optional: the biggest single file in MB (default: no limit) |

**More room with a storage server.** Three ways, from simplest:
1. **A bigger disk on your VPS.** Most hosts let you add a volume (Hetzner Volumes, for example). Mount it on the server (say at `/mnt/storage`), and in Coolify add a **Persistent Storage → Bind mount** from `/mnt/storage` to `/storage` and set `FILES_DIR=/storage`.
2. **A storage box mounted over the network.** A Hetzner Storage Box (1 TB for a few euros a month) or any server with lots of disk can be mounted on your VPS with SMB/CIFS or SSHFS, then used like option 1. Use a mount that survives a reboot (an `/etc/fstab` line) so Files never writes into an empty folder.
3. **Run EderveenGroup on the storage server itself.** Give it a domain, install Coolify or Docker there, and keep the database where it is (`DATABASE_URL`).

**Keep the secret key.** File contents are encrypted with a key derived from the server's secret (`SESSION_SECRET`, or `data/session.key`). Back up that key with your files: without it they can't be read. To back up, copy `FILES_DIR` (for example with `rsync`, or the storage box's snapshots) and back up the database as usual.

**Use Files as a drive.** In Files, choose **Connect a device**. It shows the address (`https://yourdomain/dav/`) and your username, and makes an **app password** for each computer or phone (shown once; remove it any time to disconnect that device). Your own password is never used for this, so it works for people who sign in with Microsoft or Google too.
- **Windows:** File Explorer → **This PC** → **Map network drive**, folder `https://yourdomain/dav/`, tick **Connect using different credentials**.
- **Mac:** Finder → **Go** → **Connect to Server** (⌘K), paste the address, choose **Registered User**.
- **iPhone / iPad:** an app that opens WebDAV drives, such as **Documents** or **FE File Explorer**. **PhotoSync** can back up the camera roll by itself: add a WebDAV target with the address, your username and an app password, and choose the folder **Photos**.
- **Android:** **FolderSync** or **Solid Explorer**; FolderSync and PhotoSync can upload new photos by themselves.

Photos that arrive this way keep the date the camera recorded and appear in Photos straight away.

## Adding other mail servers

1. Set `ADMIN_EMAILS` to your address (see Coolify above, or put `ADMIN_EMAILS=you@yourdomain.com` in a `.env` file next to `server.js`).
2. Share `https://yourdomain/mail/request`. The sign-in page links to it too ("Mail somewhere else?").
3. Requests appear in the **Admin** app (`/admin/`, also on the hub), and admins get a notice when they sign in. Each shows the servers and whether the settings worked. Choose **Only this address** or **Everyone @theirdomain**, then **Accept** or **Reject**.
4. The requester gets an email from your mailbox. Accepted addresses sign in at the normal sign-in page and use their own servers; everyone else keeps using Purelymail.

To keep this safe, the request form only connects to public mail servers on the standard encrypted ports (IMAP 993/143, SMTP 465/587), never to your own network. It is rate-limited, and the password is used once and thrown away. Remove an added server in Admin, then Access.

Notes: iCloud and other providers that use app passwords work here with an app password. For Gmail, Outlook.com, Hotmail and Microsoft 365, use [Sign in with Microsoft and Google](#sign-in-with-microsoft-and-google) instead: Microsoft no longer allows passwords over IMAP at all.

## Sign in with Microsoft and Google

The sign-in page always shows **Sign in with Microsoft** and **Sign in with Google**; until one is set up, it explains that it isn't switched on yet. **The easiest way to switch them on is in the Admin app: Admin, then Sign-in.** It walks through the steps below with the exact redirect address to copy, and takes the client ID and secret right there (the secret is stored encrypted and never shown again). The environment variables at the end of this section still work and take precedence. People sign in on Microsoft's or Google's own page, agree to let EderveenGroup use their mail, and land in the hub. Mail then uses a token for IMAP and SMTP; the server renews it by itself, and it's stored encrypted with the rest of the account. Each button only appears once its two variables are set.

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

## Auto editing with AI

Auto edit is only for admins (the addresses in `ADMIN_EMAILS` and people made admin in Admin → People), because it runs on your own API key. Set it up in **Admin → AI**: pick a service, follow its **Get a key** steps, paste the key and press **Save**, then **Test**. Keys are stored encrypted and never shown again (only their last four characters). Each service keeps its own key; **Use … for auto editing** switches between them.

| Service | Where to get a key | Or set on the server |
| --- | --- | --- |
| **Claude** (Anthropic, the default) | console.anthropic.com → API keys | `ANTHROPIC_API_KEY` |
| Gemini (Google) | aistudio.google.com/apikey | `GEMINI_API_KEY` |
| Groq | console.groq.com/keys | `GROQ_API_KEY` |
| OpenAI | platform.openai.com/api-keys | `OPENAI_API_KEY` |
| OpenRouter | openrouter.ai/keys | `OPENROUTER_API_KEY` |
| Mistral | console.mistral.ai → API keys | `MISTRAL_API_KEY` |
| Grok (xAI) | console.x.ai | `XAI_API_KEY` |
| Other (any OpenAI-compatible API: Together, DeepSeek, Ollama, LM Studio…) | that service | `AI_API_KEY` and `AI_BASE_URL` |

A key set in Coolify's environment variables wins over one pasted in Admin. For **Other**, give the service's API address (like `https://api.together.xyz/v1`); plain `http://` is only allowed for this computer or your own network, like `http://localhost:11434/v1` for Ollama (type any word as the key).

**Models.** For Claude choose **Claude Opus 5.5** (the default, best edits), Claude Sonnet 5.5 (faster, cheaper) or Claude Haiku 5.5 (fastest, cheapest); if Claude Opus or Sonnet declines a request, it's retried on Anthropic's recommended fallback model automatically. For the other services, press **Load models** to see what your key can use and pick one that can look at pictures (vision). Claude answers in an exact format (structured outputs); the other services are asked for JSON and their answer is checked the same way, so a weak model may need another try.

**Costs.** Each service bills its own account, separately from any chat subscription (Claude.ai, ChatGPT, Gemini). A video auto edit sends 3 to 12 small frames (512 pixels) per clip, plus some text; **Pictures per video auto edit** (1–90) limits how many, and some services (like Groq's vision models) take only a few. A photo edit sends one picture. **Admin → AI** shows this month's auto edits and tokens for all services together; the exact cost is on each service's own site. Each admin can do 40 auto edits an hour. Only frames, loudness numbers and beat times leave your server, never the video files themselves.

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
- The Photo and Video Editors work in the browser: photos and video are edited and exported on the device, and the server only keeps the files and the edit (checked on save: known footage only, every number in range)
- Auto edit is admin-only and rate-limited; API keys are stored encrypted (or kept in the server's environment) and never sent to the browser, a custom AI address must use https (plain http only on this computer or the local network), and the AI's answer is checked before an editor uses it
- Office files: documents are cleaned when saved (only allowed formatting, pictures only as embedded images), uploaded Word/Excel/PowerPoint files are read as data, never run, and a form's answers go into Excel and CSV downloads as plain values, so nothing anyone types into a form can turn into a formula. A form's public link answers only with its questions, and sending is rate-limited per address and per form
- Sender photos are fetched by the server, so senders never see your IP
- 2FA codes can't be replayed; recovery codes are single-use and stored hashed
- The data folder is readable only by the user running the app

## How sessions work

IMAP and SMTP need your password for every connection, so the session cookie carries your email and password **encrypted with the server's secret key**. (People who use Sign in with Microsoft or Google have no password in their cookie at all, only which of the two they used; their tokens are kept encrypted with their account.) The browser can't read it (HttpOnly), and without the key it's useless. The server separately keeps a small list of active sessions per account (a random id, the device and IP, and when it was last used; never the password), stored encrypted in the database, so you can see and revoke devices and restarts don't sign anyone out. If your Purelymail password changes, the next request fails auth and you're sent back to the login page. Using a Purelymail app password lets you revoke access at any time.

## Project layout

```
server.js          Entry point: loads config and starts the app
src/               The app: config, security, pages, settings validation, 2FA, devices, profiles,
                   routes/ (hub = site-wide API for usernames and Profile; apps = Notes/Tasks/Contacts/Calendar
                   and the dashboard's summary; files = Files and Photos; dav = the network drive and app
                   passwords; docs = Docs, Spreadsheets, Slides, Planner and Whiteboard;
                   chat = Chat; ai = Auto edit with AI (Admin → AI);
                   forms = Forms' responses and the public link;
                   oauth = Sign in with Microsoft/Google; servers = requests and the Admin API;
                   auth, twofa, account, mail, events)
lib/session.js     Encrypted 30-day cookie sessions
lib/vault.js       File contents on disk, encrypted in 4 MB pieces (any range readable, uploads resumable)
lib/docs.js        Shared documents (docs index, news, activity log, share links), cached and written back
lib/office.js      Word, Excel and PowerPoint files (and PDF): downloads and opening uploaded files
lib/forms.js       Forms: questions, checking answers, responses for Excel/CSV/Spreadsheets
lib/ai.js          Auto editing with AI: Claude (Anthropic SDK) and OpenAI-compatible services, what they're sent, checking the answer
public/js/formula.js  The spreadsheet formula engine (the browser and the server share it)
public/js/slidekit.js Slide themes and layouts (the editor and the .pptx/PDF downloads share them)
public/js/imagefx.js  The looks, adjustments and effects on the graphics card (WebGL), for both editors
lib/exif.js        When a photo was taken (EXIF), for photos that arrive over WebDAV
lib/ical.js        Shared calendars: fetching webcal/iCal links safely, repeats, exceptions and time zones
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
public/js/         hub.js (the dashboard), login.js, profile.js, admin.js, and the apps on top of kit.js: notes, tasks,
                   contacts, calendar, files, photos, docs, slides, sheets, forms, chat, planner, whiteboard,
                   photoedit (Photo Editor) and videoedit (Video Editor)
public/icons/apps/ The app icons
tests/             npm test: unit + HTTP integration tests (no mail server needed)
Start EderveenGroup (Windows).bat / (Mac).command / start.sh   Double-click launchers
```
