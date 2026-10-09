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
scripts/            setup utilities (password hashing, the combined start.js entrypoint)
Dockerfile          single-container image; CMD runs scripts/start.js
docker-compose.yml  Coolify/Compose deployment: one service, same image
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
npm start            # runs the bot only — this also registers slash commands on every boot
npm run dashboard    # runs the dashboard only (in a separate terminal/process)
# or run both together, the same way the Docker image does:
npm run start:all
# or, in development, with separate colored log streams instead:
npm run dev
```

The bot registers its slash commands with Discord automatically every time
it starts (no separate step needed) — it just logs a warning and keeps
running if that fails (e.g. a transient network issue), so a Discord hiccup
during startup won't stop the bot from coming online. If you ever need to
force a re-registration without restarting the bot, `npm run deploy` still
works standalone.

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

This runs as a **single container**: `scripts/start.js` launches the bot and
the dashboard together in one process tree, and the `Dockerfile`'s default
command runs it. That's deliberate — some hosts' "Dockerfile"/"Application"
deploy type builds `Dockerfile` directly and ignores `docker-compose.yml`'s
service definitions entirely, so the image has to be self-sufficient on its
own regardless of which one Coolify ends up using. Point Coolify at this repo
with **either** build pack (Dockerfile or Docker Compose) and it works the
same way: one service, one container, port `3000`.

1. In Coolify, create a new resource pointed at this repository and branch.
   Either build pack works now.
2. Set these as environment variables on that resource (do **not** commit a
   `.env` file):
   - `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (optional)
   - `DASHBOARD_URL` — the https URL Coolify gives this resource (set this
     *after* you attach a domain)
   - `DASHBOARD_ADMIN_USERNAME`, `DASHBOARD_ADMIN_PASSWORD_HASH` (generate
     locally with `npm run hash-password -- "your-password"`)
   - `SESSION_SECRET` (generate locally, see above)
   - `ORDER_WEBHOOK_SECRET` and/or `STRIPE_WEBHOOK_SECRET` if you're using
     automatic order embeds
   - ⚠️ **The bcrypt hash and any secret containing a literal `$` needs each
     `$` doubled (`$$`) when pasted into Coolify's env var field** if it's a
     Docker Compose resource — Compose treats a single `$` as the start of a
     variable reference and will silently mangle the value otherwise. Example:
     `$2a$12$abc...` → `$$2a$$12$$abc...`. (A plain Dockerfile/Application
     resource doesn't do this substitution, so paste the hash as-is there.)
3. Assign your domain to this resource and confirm Coolify's port is `3000`.
4. Deploy. Slash commands register themselves automatically on boot — no
   manual step, no need for shell access into the container. If `GUILD_ID`
   is set, double-check it's *this* server's ID: commands only register to
   that one guild when it's set, so a stale ID from a different server means
   commands silently never show up here. Leave it blank to register
   globally (works on every server the bot's in, ~1hr to propagate instead
   of instantly).
5. The `/app/data` volume persists across redeploys — restarting or
   redeploying doesn't lose your configuration, warnings, tickets, or
   giveaway history. The database schema self-migrates new columns on
   startup, so pulling updates from this repo won't require a manual migration.

Logs for both processes land in the same container log, prefixed `[bot]` /
`[dashboard]`. If either one exits unexpectedly, the supervisor shuts the
other down too and exits non-zero, so Coolify's restart policy brings the
whole thing back up together rather than leaving half of it dead.

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
