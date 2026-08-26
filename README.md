# ModSentry

A self-hosted Discord ticket + moderation bot with a full web dashboard — ticket
categories, panels (the embed + button/dropdown users click to open a ticket), staff
role pings, auto transcripts, a moderation suite, and a general embed builder/sender.
No paid hosting, no external panel — one Node.js app, one SQLite file, deployable on
any VPS. Invite it to as many servers as you want — each server's admins log in with
their own Discord account and can only configure their own server.

## What it does

- **Ticket types** — define categories (e.g. "General Support", "Billing"): which
  Discord category channel tickets go in, which staff roles get pinged and can see
  them, the ticket channel naming pattern, and a customizable welcome embed.
- **Panels** — the message with a button (or dropdown, if a panel offers several
  ticket types) that users click to open a ticket. Fully customizable embed
  (title/description/color), post it to any channel from the dashboard.
- **Tickets** — clicking a panel creates a private channel visible only to the
  opener + staff roles, pings them, and posts the welcome embed with **Claim** and
  **Close** buttons. Closing asks for an optional reason, generates an HTML
  transcript, and posts it to whichever channel you pick on the dashboard, then
  deletes the ticket channel.
- **Embed builder** — build any embed (title, description, color, author,
  thumbnail, image, footer, fields) with a live preview, save it as a reusable
  template, or send it to any channel immediately.
- **Ticket log channel** — pick one channel on the dashboard that gets a full
  audit trail: who opened each ticket and when, who claimed it, and on close —
  who closed it, why, and the full transcript file.
- **`/change`** — run inside any open ticket to move it to a different ticket
  type. Renames the channel, moves it to the new category, updates who can see
  it, and pings the new team — all in the same channel, so nothing in the
  conversation is lost.
- **Moderation** — `/ban`, `/unban`, `/kick`, `/timeout`, `/untimeout`, `/warn`,
  `/warnings`, `/clearwarnings`, `/purge`. Ban/unban/kick/timeout/untimeout/warn are
  also available as a form right on the **Moderation** tab of the dashboard — same
  real Discord actions either way, so staff without Discord open can still act.
  `/purge 10` deletes the last 10 messages; `/purge` with no number deletes everything
  in the channel Discord allows bulk-deleting (under 14 days old), after a confirm
  button so it can't happen by accident. Every action (plus swear filter deletions and
  promotions/demotions) can log to a moderation channel you pick on the dashboard, and
  is recorded either way in a searchable-by-eye log on that same page. Timeouts use
  Discord's own native timeout feature, not a custom mute role. Set up **auto-punishments**
  (e.g. "5 warnings → kick") and they fire automatically the moment a warning crosses
  that count, from either source.
- **Swear filter** — a banned-word list you manage entirely from the dashboard.
  Deletes matching messages (whole-word match, not substring), posts a
  self-deleting notice, and logs it. Staff with Manage Messages are never
  filtered. The word list is cached in memory, not re-read from the database
  on every message, so it doesn't add real load even on a busy server.
- **Staff hierarchy + `/promote` `/demote`** — define an ordered list of staff
  roles on the dashboard. You can only promote or demote someone to a rank
  *strictly below your own* (checked against both their current rank and the
  rank you're changing them to) — you can never touch a peer or a superior.
  Server owners and Administrators bypass this. Demoting the lowest rank
  removes their staff role entirely.
- **Auto-updating staff list** — pick a channel (and an embed color) on the dashboard
  and the bot keeps one message there listing everyone in each hierarchy rank, live —
  one role per row, everyone in it actually @mentioned. Role changes are debounced
  (batched a few seconds after the last change) so a bulk role update doesn't spam edits.
- **Everything above is configured from the web dashboard** — no code edits, no
  redeploys needed to change wording, roles, channels, or colors.

## 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Go to **Bot** → **Reset Token** → copy it. This is your `DISCORD_TOKEN`.
3. On the same **Bot** page, scroll to **Privileged Gateway Intents** and enable
   **Message Content Intent** (needed for transcripts and the swear filter) **and
   Server Members Intent** (needed for the staff list and `/promote`/`/demote`
   to see everyone's current roles reliably).
4. Go to **OAuth2** → **General** and copy the **Client ID**. This is your `DISCORD_CLIENT_ID`.
5. Invite the bot to your server. Build the URL like this (or use the OAuth2 URL
   Generator in the portal: scopes `bot` **and** `applications.commands`, permissions below):

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=1099780189206
   ```

   The `applications.commands` scope is required for slash commands to show up.
   If your bot is already in your server from an earlier setup, just open this
   same link again and re-authorize to pick up the new scopes/permissions —
   you don't need to kick and re-add the bot.

   That permissions value covers everything ModSentry actually needs (View Channels,
   Manage Channels, Manage Roles, Send Messages, Embed Links, Attach Files, Read
   Message History, Manage Messages, Kick Members, Ban Members, Moderate
   Members — Discord's name for the timeout permission — View Audit Log, used
   to check who added the bot when closed beta is on, and Create Instant
   Invite, used to hand the owner a working invite link for each server from
   their DM server list) and nothing more.

   **Don't grant `Administrator`.** It's not needed for anything ModSentry does, and it
   turns "someone gets hold of the bot token or a dashboard session" into "someone
   controls the entire server" instead of "someone can do what a mod can do." See
   **Permissions & security** below.

6. In your server's **Server Settings → Roles**, drag ModSentry's own role *above* every
   staff role you want it to manage (the roles used in ticket support-role pickers and
   the staff hierarchy). Discord blocks a bot from touching roles/members positioned
   at or above its own role, regardless of what permissions it holds — so it only
   needs to sit above the roles it actually manages, not at the very top.

## Permissions & security

- **No `Administrator`, ever.** The specific permissions above are the actual ceiling
  of what ModSentry can do. If the bot token or a dashboard session is ever compromised,
  that ceiling is the whole blast radius — moderation and channel/role management
  within servers it's in, nothing account-wide and nothing outside what a human mod
  could already do by hand.
- **Dashboard punishments respect the same rank rule slash commands do.** Whether a
  ban/kick/mute/warning comes from Discord or the site, it's refused if the person
  issuing it doesn't outrank the target (server owners and Administrators bypass this,
  same as always) — a dashboard login with just Manage Server can't reach past that.
- **Who can use each moderation command (and dashboard section) is decided entirely
  by the Permissions page**, not by handing out real Discord permissions. The owner
  and real Administrators always have full access; everyone else needs their role
  explicitly granted each action (e.g. a role can be allowed to `/mute` but not
  `/ban`, or `/ban` but not `/unban`) and each dashboard area (Tickets, Embeds,
  Reaction Roles, Moderation, Settings). Only the owner/Manage Server can open the
  Permissions page itself — it's never delegatable, so a granted role can't hand
  itself more access.
- **The dashboard rate-limits punishment actions** per person (a burst cap, not a
  hard ceiling) so a leaked session cookie can't be scripted into mass-banning a
  server before anyone notices.
- **If `DISCORD_TOKEN` ever leaks** (committed to git, pasted somewhere public, etc.),
  go to the Developer Portal → your app → **Bot** → **Reset Token** immediately, then
  update it in Coolify and redeploy. The old token stops working the moment you reset it.
- **Treat `.env` / Coolify's env vars like passwords.** `DISCORD_TOKEN`,
  `DISCORD_CLIENT_SECRET`, and `SESSION_SECRET` all grant real access if leaked —
  don't commit them, don't paste them in chat, don't screenshot them.
- Session cookies are `httpOnly` (JavaScript on the page can't read them) and, once
  `COOKIE_SECURE=true` is set behind HTTPS, only ever sent encrypted. Every
  state-changing dashboard request also requires a matching CSRF token.

## 2. Configure

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | What it is |
|---|---|
| `DISCORD_TOKEN` | Bot token from step 1 |
| `DISCORD_CLIENT_ID` | Application/client ID from step 1 |
| `DISCORD_CLIENT_SECRET` | Required — powers "Log in with Discord". See step 2a below |
| `DASHBOARD_URL` | Required — this app's own public URL. See step 2a below |
| `SESSION_SECRET` | Random long string for signing session cookies — change it |
| `PORT` | Port the dashboard listens on (default `3000`) |
| `COOKIE_SECURE` | Leave `false` while accessing over plain `http://IP:PORT`. Set to `true` once the dashboard is behind HTTPS (e.g. a domain + Let's Encrypt via Coolify) |
| `OWNER_DISCORD_ID` | Optional — your Discord user ID, for running a closed beta. See step 2b below |

## 2a. Set up "Log in with Discord"

The dashboard has one login method: Discord OAuth. Anyone who logs in only sees
and can configure servers where they're the owner or have the **Manage Server**
permission — never any other server, even other ones ModSentry is in.

1. In the Developer Portal, go to **OAuth2** → **General**.
2. Under **Client Secret**, click **Reset Secret** and copy it → this is `DISCORD_CLIENT_SECRET`.
3. Decide the exact public URL the dashboard will run at (e.g. `https://tickets.example.com`)
   → this is `DASHBOARD_URL` (no trailing slash).
4. On the same OAuth2 page, under **Redirects**, add:
   ```
   https://tickets.example.com/auth/discord/callback
   ```
   (your actual `DASHBOARD_URL` + `/auth/discord/callback` — must match exactly, including https).
5. Set both `DISCORD_CLIENT_SECRET` and `DASHBOARD_URL` in your `.env`. The app refuses
   to start without them.

**Moved to a new domain?** Login will fail with Discord's "Invalid OAuth2 redirect_uri"
error (shown in whatever language your browser is set to — e.g. "Ongeldige OAUTH2
redirect_uri" in Dutch) until *both* of these are updated to match — code changes alone
don't fix it:
- `DASHBOARD_URL` in your deployment's environment variables, redeployed/restarted
- The **Redirects** list on the OAuth2 page in the Developer Portal — add the new URL,
  it doesn't replace the old one automatically

## 2b. (Optional) Run a closed beta

Want to keep the dashboard invite-only for now — only specific people you pick can log
in and invite the bot? Set `OWNER_DISCORD_ID` in your `.env` to your own Discord user ID
(Discord → User Settings → Advanced → enable Developer Mode, then right-click your own
name → **Copy User ID**).

Log in with that Discord account and you'll see an **🔒 Admin** link in the header. From
there, flip on **Closed beta enabled** and add the Discord user IDs of everyone else
you want to let in (same copy-ID trick, on their account). While it's on, anyone not on
that list — and not you — gets turned away at login with a message telling them who to
ask (set `BETA_CONTACT_HANDLE` in `.env` to your Discord handle; defaults to
`spontanedonder`). Leave `OWNER_DISCORD_ID` unset to skip this feature entirely; nobody
gets locked out and the admin panel doesn't exist.

Note: this only gates *new* logins — someone already logged in before you enabled it
stays logged in until their session expires (7 days) or they log out.

## 3. Run it

**Locally / directly on a VPS:**

```bash
npm install
npm start
```

Then open `http://YOUR_VPS_IP:3000` and log in with Discord.

**With Docker (recommended for the VPS — this is what Coolify will do for you):**

```bash
docker build -t modsentry .
docker run -d --name modsentry \
  --env-file .env \
  -p 3000:3000 \
  -v modsentry-data:/app/data \
  --restart unless-stopped \
  modsentry
```

The SQLite database lives in the `modsentry-data` volume, so it survives restarts
and redeploys.

**On Coolify:** create a new Application → point it at this repo (or upload the
folder) → it detects the `Dockerfile` automatically → paste the same variables from
`.env` into Coolify's Environment Variables tab → deploy. Attach a persistent
volume mounted at `/app/data` so the database isn't wiped on redeploy.

## 4. Using the dashboard

1. Log in at `/` with **Log in with Discord** — you'll see every server ModSentry is in
   that you own or have Manage Server on, plus an **+ Invite to Server** button in the
   header to add it to any other server of yours.
2. Pick a server → **Settings** → choose your **transcript channel** (where closed
   ticket transcripts get posted). This is the one thing worth setting first.
3. **Tickets** → **New ticket type** → name it, pick the category channel tickets
   should be created under, pick the staff role(s) to ping and give access,
   customize the welcome embed.
4. **Tickets** → **New panel** → write the panel's embed text, pick which ticket
   type(s) it offers, save, then pick a channel and hit **Post panel**. That posts
   the embed + button/dropdown into your server.
5. **Embeds** → build any embed with the live preview, save it as a template for
   reuse, or send it straight to a channel (e.g. for announcements, rules, etc.).
6. **Moderation** → optionally set up the swear filter (enable it + paste in your
   word list), build your staff hierarchy (add roles, lowest to highest — use the
   ↑/↓ buttons to reorder), and pick a channel for the auto-updating staff list.
   None of this is required for moderation *commands* to work — `/ban`, `/kick`,
   `/timeout`, `/warn`, etc. work immediately based on real Discord permissions.
   The hierarchy is only needed for `/promote` and `/demote`.

Ticket flow after that is automatic: a user clicks the panel button → gets a
private channel → staff get pinged → staff can **Claim** or **Close** (with an
optional reason) → on close, a full transcript is posted to your transcript
channel and the ticket channel is deleted a few seconds later.

## Notes

- Logging in is Discord-only (**Discord OAuth**), scoped per-user to only servers
  they own or have Manage Server on — nobody can see or touch a server that isn't
  theirs, including you.
- The database is a single SQLite file at `DB_PATH` (`/app/data/bot.sqlite` in
  Docker). Back it up by copying that file.
- **On resource usage**: the swear filter and staff hierarchy are cached in memory
  per server and only recomputed when you actually change them on the dashboard —
  the bot isn't hitting the database on every single message. The staff list
  batches rapid role changes into one update instead of editing the message
  repeatedly. Member data (needed for the staff list and promote/demote) is only
  fetched for servers that actually use the staff list feature, not eagerly for
  every server the bot is in. Still just one lightweight Node process — this
  doesn't meaningfully change what the VPS needs to handle it.
