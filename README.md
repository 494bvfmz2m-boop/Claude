# All-in-One Discord Bot + Dashboard

A Discord.js v14 bot with moderation, a ticket system, anti-raid protection,
giveaways, join/leave announcements, automatic order embeds, and a secure
web dashboard for managing it all — built with Node.js, SQLite and Express.

## Features

- **Moderation** — `/kick`, `/ban`, `/unban`, `/timeout`, `/warn`, `/warnings`, `/clear`, all logged to a mod-log channel.
- **Tickets** — a fully customizable button panel: `/ticketpanel edit` opens an in-Discord modal editor (title, description, button label/emoji, embed color) and `/ticketpanel post` places it in a channel. Opening a ticket creates a private channel per user, with claim/close buttons.
- **Anti-raid** — flags join bursts and accounts under a minimum age, auto-kicks/bans, and alerts a log channel.
- **Giveaways** — `/gstart`, `/gend`, `/greroll`, `/glist`, with an embed + Enter button; winners are picked automatically when the timer ends (survives restarts).
- **Join/leave notices** — configurable welcome/leave embeds with `{user}`, `{server}`, `{membercount}` placeholders.
- **Automatic order embeds** — `/order` posts one manually; `POST /api/webhook/order/:guildId` (a shared secret) lets any custom website/backend trigger one; `POST /api/webhook/stripe/:guildId` verifies a real Stripe webhook signature and posts one straight from `checkout.session.completed` / `payment_intent.succeeded`.
- **Anti-raid honeypot** — `/config honeypot` creates (or adopts) a decoy channel nobody legitimate should ever post in. Anyone who does (other than staff) is instantly soft-banned: kicked and their recent messages purged, but free to rejoin — it's a trap, not a permanent ban.
- **Dashboard** — a password-protected web UI to configure everything above, and to view tickets, giveaways, orders, and warnings, without touching Discord.

## Project layout

```
src/                the bot (discord.js client, commands, events, handlers)
dashboard/          the web dashboard (Express server + static frontend)
data/               SQLite database (created automatically, gitignored)
scripts/            setup utilities (password hashing)
Dockerfile          image shared by both services (see docker-compose.yml)
docker-compose.yml  Coolify deployment: bot + dashboard services, shared volume
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

For automatic order embeds, configure **one** of:

- **Custom website/backend** — set `ORDER_WEBHOOK_SECRET` to a long random
  value, then have your backend `POST` to `/api/webhook/order/:guildId`
  (your Discord server ID) with header `x-webhook-secret: <that value>` and
  JSON body `{ "order_ref", "product", "customer", "amount", "status" }`.
- **Stripe** — create a webhook endpoint in the Stripe Dashboard pointing at
  `https://your-dashboard-domain/api/webhook/stripe/:guildId`, subscribed to
  `checkout.session.completed` and/or `payment_intent.succeeded`, then put
  its signing secret in `STRIPE_WEBHOOK_SECRET`. The signature is verified
  with Stripe's own SDK before anything is posted; unsigned or mis-signed
  requests are rejected. Set a `product` key in the Checkout Session's
  `metadata` so the embed shows a real product name.

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

- `/config welcome channel:` / `/config leave channel:` — pick the channel, then a modal opens
  in Discord to write the multi-line message template (`{user}`, `{server}`, `{membercount}`)
- `/config logs` / `/config modlog` — logging channels
- `/config tickets` — ticket category, staff role, ticket log channel; then customize the panel
  itself with `/ticketpanel edit` (opens a modal for title/description/button/color) and place it
  with `/ticketpanel post #channel`
- `/config orders` — channel for order embeds
- `/config antiraid` — enable/tune anti-raid protection
- `/config honeypot enabled:true [channel] [name]` — sets up the trap channel
  (creates one if you don't pass an existing `channel`); `enabled:false`
  disables it without deleting the channel. **Never link or mention this
  channel to members**, and don't post in it yourself with a non-staff
  account — that's the point.

## Deploying on Coolify

The repo ships a `docker-compose.yml` and `Dockerfile` built for this: two
services (`bot` and `dashboard`) from the same image, sharing one persistent
volume (`bot-data`) for the SQLite database so both processes see the same
data.

1. In Coolify, create a new resource → **Docker Compose**, pointed at this
   repository (it will pick up `docker-compose.yml` at the root automatically).
2. Coolify scans the compose file for `${VARIABLE}` placeholders and turns
   each into an input field in its UI — fill in all of these there (do **not**
   commit a `.env` file):
   - `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (optional)
   - `DASHBOARD_URL` — the public https URL Coolify will give the `dashboard`
     service (set this *after* Coolify assigns/you attach a domain)
   - `DASHBOARD_ADMIN_USERNAME`, `DASHBOARD_ADMIN_PASSWORD_HASH` (generate
     locally with `npm run hash-password -- "your-password"`)
   - `SESSION_SECRET` (generate locally, see above)
   - `ORDER_WEBHOOK_SECRET` and/or `STRIPE_WEBHOOK_SECRET` if you're using
     automatic order embeds
   - ⚠️ **The bcrypt hash and any secret containing a literal `$` needs each
     `$` doubled (`$$`) when pasted into Coolify's env var field** — Compose
     treats a single `$` as the start of a variable reference and will
     silently mangle the value otherwise. Example:
     `$2a$12$abc...` → `$$2a$$12$$abc...`.
3. Expose the `dashboard` service on a domain in Coolify (it listens on port
   `3000` internally) and leave `bot` with no exposed port — it only needs
   outbound access to Discord's gateway.
4. Deploy. Once it's up, register slash commands once from your machine (or
   a one-off Coolify command) with `DISCORD_TOKEN=... CLIENT_ID=... npm run deploy`,
   since that's a one-time action, not something that needs to run in the
   container.
5. The `bot-data` volume persists across redeploys — restarting or
   redeploying the stack doesn't lose your configuration, warnings, tickets,
   or giveaway history. The database schema self-migrates new columns on
   startup, so pulling updates from this repo won't require a manual migration.

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

## Notes on the honeypot

- The trap channel is a normal, visible text channel — hiding it defeats the
  purpose, since a raid/spam bot that can't see it can't fall into it.
  Legitimate members simply have no reason to type there; the risk is a
  member trying it out of curiosity, which is why staff (Ban Members /
  Moderate Members) are exempt from the auto soft-ban and get a warning
  in the log channel instead.
- A "soft ban" here is a ban immediately followed by an unban: it kicks the
  member, deletes their recent messages (up to 7 days, the maximum Discord
  allows), and logs the action — but does **not** prevent them from
  rejoining. It's meant to disrupt a raid in progress and clean up spam, not
  to permanently punish.
- Every trigger is logged to the configured log channel and recorded in the
  database as a `honeypot_softban` moderation action.
