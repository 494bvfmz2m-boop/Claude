# ModReply

A Discord bot for support/ticket servers. It answers common questions in
ticket channels from a keyword-matched FAQ database and, when it can't find
a confident match, pings a support role for you. No AI/LLM involved — just
a small, transparent matching algorithm you can fully inspect, plus a web
dashboard (with Discord login) to manage it across as many servers as you
run the bot in.

## Features

- **`/ask <question>`** — searches the FAQ database for the best keyword
  match and replies with the answer. If nothing matches confidently, it
  automatically pings your support role instead of guessing.
- **`/escalate [reason]`** — the "I don't want the bot's answer" command.
  Runs instantly and pings the support role directly, regardless of what
  `/ask` did or didn't find.
- **"This didn't help" button** — attached to every automated answer, in
  case the match was wrong.
- **Ticket-only by category** — commands only work inside channels that
  live under category IDs you configure in the dashboard (works with any
  existing ticket-creation bot, since it doesn't touch ticket creation
  itself).
- **Multi-server web dashboard** (`http://localhost:3000` by default) —
  people log in with their own Discord account. Anyone with **Manage
  Server** permission in a server the bot is installed in can manage that
  server's FAQ database, ticket categories, and support role — no shared
  password, no per-server bot reinvite. Dropdowns are populated live from
  Discord (no manually copying IDs).

## How matching works (no AI)

Each FAQ entry has a question, optional comma-separated keywords, and an
answer. When someone runs `/ask`, the bot tokenizes their question and
scores it against every entry's question + keywords by word overlap. The
entry with the most overlapping words wins, as long as it clears two
minimum thresholds (`MATCH_MIN_OVERLAP`, `MATCH_MIN_RATIO` in `.env`). If
nothing clears the bar, the bot escalates instead of answering — it never
invents an answer.

Add a few keywords to each FAQ entry (e.g. `password, reset, login,
forgot`) to make matching much more reliable.

## Setup

### 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Under **Bot**, click **Add Bot**, then copy the **Token**.
3. Under **OAuth2 → General**, copy the **Client ID** and **Client Secret**.
4. Still under **OAuth2 → General**, add a **Redirect** URL:
   `http://localhost:3000/auth/discord/callback` for local dev, and your
   real dashboard URL (e.g. `https://tickets.yourdomain.com/auth/discord/callback`)
   for production. This is what lets people log into the dashboard with
   Discord — it must match `DISCORD_REDIRECT_URI` in `.env` exactly.
5. Under **OAuth2 → URL Generator**, select scopes `bot` and
   `applications.commands`, and bot permissions `Send Messages`,
   `Embed Links`, `Read Message History`, `View Channels`, `Mention
   @everyone, here, and All Roles` (needed to ping the support role — or
   just make sure the role is mentionable). Open the generated URL to
   invite the bot to each server you want it in.

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
- `DISCORD_GUILD_ID` — optional, for instant slash-command registration
  to one server while testing. Leave blank for global commands (slower
  to propagate, ~1 hour).
- `SESSION_SECRET` — any long random string.
- `SUPER_ADMIN_DISCORD_IDS` — optional, comma-separated Discord user IDs
  that can manage every server the bot is in regardless of their
  permissions in each one (useful for whoever operates the bot itself).

### 3. Register slash commands and start

```bash
npm run register-commands
npm start
```

The bot logs in and the dashboard starts on the configured `PORT`
(default `3000`).

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
  the Discord Developer Portal), `DISCORD_GUILD_ID` (optional),
  `SESSION_SECRET`, `SUPER_ADMIN_DISCORD_IDS` (optional),
  `DATABASE_FILE=/app/data/bot.sqlite3`.
- **Slash commands:** `npm run register-commands` doesn't need to run
  inside the container — it just calls the Discord API. Run it once from
  your local machine (with the same `DISCORD_TOKEN`/`DISCORD_CLIENT_ID`/
  `DISCORD_GUILD_ID` in a local `.env`) before or after the first deploy.

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
