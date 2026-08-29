# ModReply

A Discord bot for support/ticket servers. It answers common questions in
ticket channels from a keyword-matched FAQ database and, when it can't find
a confident match, pings a support role for you. No AI/LLM involved — just
a small, transparent matching algorithm you can fully inspect, plus a web
dashboard (with Discord login) to manage it across as many servers as you
run the bot in.

## Features

- **Auto-reply** — every plain message someone types in a ticket channel
  is checked against the FAQ database automatically, no command needed.
  A confident match gets an instant reply. The *first* message in a
  ticket that doesn't match anything automatically pings your support
  role — later unmatched chatter in the same ticket won't re-ping (only
  the first miss escalates, so ordinary back-and-forth doesn't spam
  staff).
- **`/ask <question>`** — same matching, on demand. Useful for staff
  re-checking the FAQ, or if someone wants to ask outside of what they
  already typed.
- **`/escalate [reason]`** — the "I don't want the bot's answer" command.
  Runs instantly and pings the support role directly, regardless of what
  auto-reply or `/ask` did or didn't find.
- **"This didn't help" button** — attached to every automated answer
  (auto-reply and `/ask` alike), in case the match was wrong.
- **Ticket-only by category** — all of the above only activates inside
  channels that live under category IDs you configure in the dashboard
  (works with any existing ticket-creation bot, since it doesn't touch
  ticket creation itself).
- **Multi-server web dashboard** (`http://localhost:3000` by default) —
  people log in with their own Discord account. Anyone with **Manage
  Server** permission in a server the bot is installed in can manage that
  server's FAQ database, ticket categories, and support role — no shared
  password, no per-server bot reinvite. Dropdowns are populated live from
  Discord (no manually copying IDs).

## How matching works (no AI)

Each FAQ entry has a question, optional comma-separated keywords, and an
answer. For every message in a ticket channel (or a `/ask` question), the
bot tokenizes the text and scores it against every entry's question +
keywords by word overlap. The entry with the most overlapping words wins,
as long as it clears two minimum thresholds (`MATCH_MIN_OVERLAP`,
`MATCH_MIN_RATIO` in `.env`). If nothing clears the bar, the bot escalates
instead of answering — it never invents an answer.

Add a few keywords to each FAQ entry (e.g. `password, reset, login,
forgot`) to make matching much more reliable.

## Setup

### 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Under **Bot**, click **Add Bot**, then copy the **Token**.
3. Still under **Bot**, scroll to **Privileged Gateway Intents** and turn
   **on Message Content Intent**. This is required for auto-reply to see
   what people type in ticket channels at all — without it, every message
   looks empty to the bot and auto-reply silently never fires (no error,
   just nothing happens). `/ask` and `/escalate` don't need this, only
   auto-reply does.
4. Under **OAuth2 → General**, copy the **Client ID** and **Client Secret**.
5. Still under **OAuth2 → General**, add a **Redirect** URL:
   `http://localhost:3000/auth/discord/callback` for local dev, and your
   real dashboard URL (e.g. `https://tickets.yourdomain.com/auth/discord/callback`)
   for production. This is what lets people log into the dashboard with
   Discord — it must match `DISCORD_REDIRECT_URI` in `.env` exactly.
6. Under **OAuth2 → URL Generator**, select scopes `bot` **and**
   `applications.commands` (skipping `applications.commands` is the #1
   cause of "/ask doesn't show up at all" — the bot literally isn't
   allowed to register slash commands in that server without it), and
   bot permissions `Send Messages`, `Embed Links`, `Read Message
   History`, `View Channels`, `Mention @everyone, here, and All Roles`
   (needed to ping the support role — or just make sure the role is
   mentionable). Open the generated URL to invite the bot to each server
   you want it in — or once the bot is running, just use the **Invite**
   button in the dashboard/login page, which always includes both scopes.
   If the bot was ever invited to a server *before* you added the
   `applications.commands` scope, re-invite it there with that URL —
   re-inviting is safe and doesn't duplicate anything.

### 2. Configure the project

```bash
cp .env.example .env
npm install
```

Fill in `.env`:

- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` — from step 1.
- `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` — for dashboard login,
  from step 1.4. `DISCORD_REDIRECT_URI` must exactly match a redirect
  you registered in the Developer Portal.
- `DISCORD_GUILD_ID` — optional, unused by the bot itself now (see
  below); only relevant to the standalone `npm run register-commands`
  script.
- `SESSION_SECRET` — any long random string.
- `SUPER_ADMIN_DISCORD_IDS` — optional, comma-separated Discord user IDs
  that can manage every server the bot is in regardless of their
  permissions in each one (useful for whoever operates the bot itself).

### 3. Start

```bash
npm start
```

The bot logs in, the dashboard starts on the configured `PORT` (default
`3000`), and **the bot automatically registers `/ask` and `/escalate` in
every server it's in — instantly, on every startup.** There's no
separate "register commands" step to remember; this is also why a fresh
Coolify deploy doesn't need any manual command-registration step. If a
particular server is missing the `applications.commands` invite scope,
that server's sync fails and gets logged (`Failed to sync slash commands
for guild ...`) but doesn't affect any other server or crash the bot —
fix it by re-inviting the bot there with the URL from step 1.5 or the
dashboard's Invite button.

(`npm run register-commands` still exists for registering commands
*globally*, e.g. if you're distributing this bot to servers you don't
control ahead of time and can't wait for it to join first — but for a
normal single-operator setup you'll never need it.)

### 4. Configure via the dashboard

1. Open `http://localhost:3000`, click **Log in with Discord**.
2. Pick a server from the "Your servers" grid — only servers where you
   have Manage Server permission (and the bot is installed) will show up.
3. **Ticket Categories** tab — add the category (or categories) that
   server's ticket channels live under.
4. **Support Role** tab — pick the role to ping when escalating.
5. **FAQ Database** tab — add questions/keywords/answers.

Repeat per server — anyone on your staff with Manage Server permission in
a given server can log in themselves and configure that server, without
needing a shared dashboard password.

That's it — `/ask` and `/escalate` will now work in any channel under a
configured category.

## Deploying on Coolify

- **Repository:** `494bvfmz2m-boop/claude`
- **Branch:** `claude/discord-auto-reply-tickets-44awck`
- **Build pack:** Dockerfile (the repo includes one at the root — `better-sqlite3`
  is a native module, so this is more reliable than Nixpacks auto-detect).
- **Port:** `3000` (or set `PORT` and match it in Coolify's port mapping).
- **Persistent storage:** mount a volume at `/app/data` — that's where the
  SQLite file lives. Without it, your FAQ database resets on every
  redeploy.
- **Environment variables** (set these in Coolify, not in `.env` — the
  Dockerfile doesn't ship one): `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`,
  `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` (your real Coolify
  domain + `/auth/discord/callback` — must also be added as a redirect in
  the Discord Developer Portal), `SESSION_SECRET`,
  `SUPER_ADMIN_DISCORD_IDS` (optional), `DATABASE_FILE=/app/data/bot.sqlite3`.
- **Slash commands:** nothing to do — the bot registers `/ask` and
  `/escalate` in every server it's in automatically on startup (see
  above). If they don't show up after deploying, it's almost always the
  bot missing the `applications.commands` invite scope in that specific
  server (check the container logs for `Failed to sync slash commands`)
  — fix it by re-inviting via the dashboard's Invite button.

## Project layout

```
src/
  config.js            env var loading
  db.js                SQLite schema + queries (better-sqlite3)
  matcher.js           keyword-overlap FAQ matching (no AI)
  discord/
    bot.js             slash command + button handling
    deploy-commands.js registers /ask and /escalate with Discord
  web/
    server.js           Express dashboard + REST API + Discord OAuth login
    public/              dashboard frontend (vanilla HTML/CSS/JS)
  index.js              starts the bot and the dashboard together
```

Data is stored in a local SQLite file (`DATABASE_FILE`, default
`./data/bot.sqlite3`) — back that file up if you want to keep your FAQ
database.

## Access control

There's no dashboard password anymore — access is entirely driven by
Discord itself:

- Logging in requires a real Discord account (OAuth2, scopes `identify`
  and `guilds`).
- A logged-in user can only see and manage servers where **both** of the
  following are true: the bot is installed there, and they have the
  **Manage Server** (or Administrator, or server owner) permission there.
- Permissions are snapshotted at login time and cached in the session
  (12-hour cookie). If someone's server role changes, they'll need to log
  out and back in for it to take effect.
- `SUPER_ADMIN_DISCORD_IDS` (optional) bypasses the per-server check
  entirely for the listed Discord user IDs.

## Running in production

Run `node src/index.js` under a process manager (pm2, systemd, Docker,
etc.) so it restarts on crash/reboot. Put the dashboard behind HTTPS (a
reverse proxy like nginx/Caddy, or a platform that terminates TLS for you)
— Discord OAuth requires an HTTPS redirect URI in production, and session
cookies should never travel over plain HTTP.
