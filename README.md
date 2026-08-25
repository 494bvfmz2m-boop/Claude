# Ticket Bot

A self-hosted Discord ticket bot with a web dashboard for full customization — ticket
categories, panels (the embed + button/dropdown users click to open a ticket), staff
role pings, auto transcripts, and a general embed builder/sender. No paid hosting, no
external panel — one Node.js app, one SQLite file, deployable on any VPS.

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
- **Everything above is configured from the web dashboard** — no code edits, no
  redeploys needed to change wording, roles, channels, or colors.

## 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Go to **Bot** → **Reset Token** → copy it. This is your `DISCORD_TOKEN`.
3. On the same **Bot** page, scroll to **Privileged Gateway Intents** and enable
   **Message Content Intent** (needed to include message text in transcripts).
4. Go to **OAuth2** → **General** and copy the **Client ID**. This is your `DISCORD_CLIENT_ID`.
5. Invite the bot to your server. Build the URL like this (or use the OAuth2 URL
   Generator in the portal: scopes `bot` **and** `applications.commands`, permissions below):

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=268561424
   ```

   The `applications.commands` scope is required for the `/change` slash command
   (used inside a ticket to move it to a different category) to show up. If your
   bot is already in your server from before this scope was added, just open this
   same link again and re-authorize — you don't need to kick and re-add the bot.

   That permissions value covers: View Channels, Manage Channels, Manage Roles,
   Send Messages, Embed Links, Attach Files, Read Message History, Manage Messages
   — everything the bot needs to create ticket channels, set their permissions, and
   clean them up. (You can grant `Administrator` instead if you'd rather not think
   about it, but the above is the minimum it actually needs.)

## 2. Configure

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | What it is |
|---|---|
| `DISCORD_TOKEN` | Bot token from step 1 |
| `DISCORD_CLIENT_ID` | Application/client ID from step 1 |
| `ADMIN_PASSWORD` | Password to log into the web dashboard — change it |
| `SESSION_SECRET` | Random long string for signing session cookies — change it |
| `PORT` | Port the dashboard listens on (default `3000`) |
| `COOKIE_SECURE` | Leave `false` while accessing over plain `http://IP:PORT`. Set to `true` once the dashboard is behind HTTPS (e.g. a domain + Let's Encrypt via Coolify) |

## 3. Run it

**Locally / directly on a VPS:**

```bash
npm install
npm start
```

Then open `http://YOUR_VPS_IP:3000` and log in with `ADMIN_PASSWORD`.

**With Docker (recommended for the VPS — this is what Coolify will do for you):**

```bash
docker build -t ticket-bot .
docker run -d --name ticket-bot \
  --env-file .env \
  -p 3000:3000 \
  -v ticket-bot-data:/app/data \
  --restart unless-stopped \
  ticket-bot
```

The SQLite database lives in the `ticket-bot-data` volume, so it survives restarts
and redeploys.

**On Coolify:** create a new Application → point it at this repo (or upload the
folder) → it detects the `Dockerfile` automatically → paste the same variables from
`.env` into Coolify's Environment Variables tab → deploy. Attach a persistent
volume mounted at `/app/data` so the database isn't wiped on redeploy.

## 4. Using the dashboard

1. Log in at `/` with `ADMIN_PASSWORD`. You'll see every server the bot is in.
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

Ticket flow after that is automatic: a user clicks the panel button → gets a
private channel → staff get pinged → staff can **Claim** or **Close** (with an
optional reason) → on close, a full transcript is posted to your transcript
channel and the ticket channel is deleted a few seconds later.

## Notes

- The dashboard has one shared login (`ADMIN_PASSWORD`) — anyone with it can manage
  every server the bot is in. That's intentional for personal/small-team use; there's
  no per-user Discord OAuth login. Keep the password private.
- The database is a single SQLite file at `DB_PATH` (`/app/data/bot.sqlite` in
  Docker). Back it up by copying that file.
