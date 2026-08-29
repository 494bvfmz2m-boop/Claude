# Ticket Auto-Reply Bot

A Discord bot for support/ticket servers. It answers common questions in
ticket channels from a keyword-matched FAQ database and, when it can't find
a confident match, pings a support role for you. No AI/LLM involved — just
a small, transparent matching algorithm you can fully inspect, plus a web
dashboard to manage everything.

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
- **Web dashboard** (`http://localhost:3000` by default) — password
  protected. Manage the FAQ database, ticket categories, and the support
  role, all with dropdowns populated live from your Discord server (no
  manually copying IDs).

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
3. Under **OAuth2 → General**, copy the **Client ID**.
4. Under **OAuth2 → URL Generator**, select scopes `bot` and
   `applications.commands`, and bot permissions `Send Messages`,
   `Embed Links`, `Read Message History`, `View Channels`, `Mention
   @everyone, here, and All Roles` (needed to ping the support role — or
   just make sure the role is mentionable). Open the generated URL to
   invite the bot to your server.

### 2. Configure the project

```bash
cp .env.example .env
npm install
npm run hash-password   # follow the prompt, paste the output line into .env
```

Fill in `.env`:

- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` — from step 1.
- `DISCORD_GUILD_ID` — your server's ID, for instant slash-command
  registration while testing. Leave blank for global commands (slower to
  propagate, ~1 hour).
- `SESSION_SECRET` — any long random string.
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD_HASH` — dashboard login.

### 3. Register slash commands and start

```bash
npm run register-commands
npm start
```

The bot logs in and the dashboard starts on the configured `PORT`
(default `3000`).

### 4. Configure via the dashboard

1. Open `http://localhost:3000`, log in.
2. Pick your server from the dropdown.
3. **Ticket Categories** tab — add the category (or categories) your
   ticket channels live under.
4. **Support Role** tab — pick the role to ping when escalating.
5. **FAQ Database** tab — add questions/keywords/answers.

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
  `DISCORD_GUILD_ID` (optional), `SESSION_SECRET`,
  `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD_HASH` (generate locally
  with `npm run hash-password`), `DATABASE_FILE=/app/data/bot.sqlite3`.
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
    server.js           Express dashboard + REST API
    public/              dashboard frontend (vanilla HTML/CSS/JS)
  index.js              starts the bot and the dashboard together
scripts/
  hash-password.js      generates DASHBOARD_PASSWORD_HASH
```

Data is stored in a local SQLite file (`DATABASE_FILE`, default
`./data/bot.sqlite3`) — back that file up if you want to keep your FAQ
database.

## Running in production

Run `node src/index.js` under a process manager (pm2, systemd, Docker,
etc.) so it restarts on crash/reboot. Put the dashboard behind HTTPS (a
reverse proxy like nginx/Caddy, or a platform that terminates TLS for you)
since login credentials are sent to it.
