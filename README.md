# All-in-One Discord Bot + Dashboard

A Discord.js v14 bot with moderation, a ticket system, anti-raid protection,
giveaways, join/leave announcements, automatic order embeds, and a secure
web dashboard for managing it all — built with Node.js, SQLite and Express.

## Features

- **Moderation** — `/kick`, `/ban`, `/unban`, `/timeout`, `/warn`, `/warnings`, `/clear`, all logged to a mod-log channel.
- **Tickets** — a button panel (`/ticketpanel`) opens a private channel per user, with claim/close buttons.
- **Anti-raid** — flags join bursts and accounts under a minimum age, auto-kicks/bans, and alerts a log channel.
- **Giveaways** — `/gstart`, `/gend`, `/greroll`, `/glist`, with an embed + Enter button; winners are picked automatically when the timer ends (survives restarts).
- **Join/leave notices** — configurable welcome/leave embeds with `{user}`, `{server}`, `{membercount}` placeholders.
- **Automatic order embeds** — `/order` posts an order embed manually, and `POST /api/webhook/order/:guildId` lets an external store/payment system (Stripe, Shopify, your own checkout, etc.) trigger one automatically.
- **Dashboard** — a password-protected web UI to configure everything above, and to view tickets, giveaways, orders, and warnings, without touching Discord.

## Project layout

```
src/            the bot (discord.js client, commands, events, handlers)
dashboard/      the web dashboard (Express server + static frontend)
data/           SQLite database (created automatically, gitignored)
scripts/        setup utilities (password hashing)
```

Both the bot and the dashboard read/write the same SQLite database
(`data/bot.sqlite`), and the dashboard talks to Discord over the REST API
directly with the bot token — it does not need the bot process running to
manage settings, though giveaway timers are only processed while the bot
is online.

## Setup

### 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Under **Bot**, create a bot user, enable the **Server Members Intent** and **Message Content Intent**, and copy the bot **token**.
3. Under **OAuth2 → General**, copy the **Client ID**.
4. Invite the bot with the `bot` and `applications.commands` scopes and at minimum: Manage Roles, Manage Channels, Kick Members, Ban Members, Moderate Members, Manage Messages, Send Messages, Embed Links, Read Message History.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `DISCORD_TOKEN`, `CLIENT_ID`, and (optionally) `GUILD_ID` for fast
command updates during development.

Generate the dashboard's admin password hash and a session secret:

```bash
npm install
npm run hash-password -- "your-strong-password"
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put the resulting hash into `DASHBOARD_ADMIN_PASSWORD_HASH` and the random
string into `SESSION_SECRET`. Never put a plaintext password in `.env` —
only the bcrypt hash is stored. `.env` is gitignored and must never be
committed.

If you plan to wire up automatic order embeds from an external store, set
`ORDER_WEBHOOK_SECRET` to a long random value and have that system send it
as the `x-webhook-secret` header.

### 3. Install and run

```bash
npm install
npm run deploy      # registers slash commands with Discord
npm start            # runs the bot
npm run dashboard    # runs the dashboard (in a separate terminal/process)
# or, in development, run both at once:
npm run dev
```

The dashboard listens on `DASHBOARD_PORT` (default `3000`). Log in with the
username/password you configured above.

### 4. Configure the bot per-server

In Discord (or via the dashboard **Settings** tab), run `/config` to set:

- `/config welcome` / `/config leave` — join/leave channels & messages
- `/config logs` / `/config modlog` — logging channels
- `/config tickets` — ticket category, staff role, ticket log channel, then `/ticketpanel #channel` to post the panel
- `/config orders` — channel for order embeds
- `/config antiraid` — enable/tune anti-raid protection

## Security notes

The dashboard is a **single-admin** control panel, not a multi-tenant SaaS:
whoever holds the admin credentials can manage every server the bot is in.
Treat the password like any other admin credential.

- Passwords are never stored in plaintext — only a bcrypt hash (cost 12).
- Login is rate-limited (5 attempts / 15 minutes per IP) and returns a
  generic error for both a wrong username and a wrong password, comparing
  against a decoy hash in the wrong-username case to avoid leaking which
  part was incorrect via timing.
- Sessions are httpOnly, `SameSite=Strict` cookies, regenerated on login
  (session-fixation protection), and expire after 2 hours of inactivity.
  Set `NODE_ENV=production` (behind HTTPS/a reverse proxy) to enable the
  `Secure` cookie flag.
- All state-changing dashboard requests require a per-session CSRF token
  sent as the `x-csrf-token` header; requests without a valid token are
  rejected.
- Security headers (CSP, frame-ancestors, etc.) are applied via Helmet.
- The external order webhook is authenticated by a separate shared secret
  header, independent of the dashboard session, and rate-limited.
- If `SESSION_SECRET` or the admin password hash are missing/weak, the
  dashboard refuses to start rather than falling back to an insecure default.

## Notes on giveaways & tickets

- Giveaway winners are picked by a background check (every 15s) that scans
  the database for expired, unended giveaways — so a giveaway started from
  Discord or from the dashboard is handled identically, and survives a bot
  restart as long as it comes back up before too long.
- Tickets are per-user (one open ticket at a time), permissioned so only the
  opener, the configured staff role, and Manage Server admins can see the
  channel, and are logged to the ticket log channel on open/close.
