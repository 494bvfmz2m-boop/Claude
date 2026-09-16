# Discord Reminder Bot

A Discord bot for one-time, monthly, quarterly, and yearly reminders. When a
reminder fires it DMs a fixed owner and posts in a per-server channel that
admins configure with `/set channel`.

## Features

- `/reminder set` — create a reminder with a description, frequency
  (One-Time / Monthly / Quarterly / Yearly), start date, time, and timezone.
- `/reminder edit` — change any field of an existing reminder (with
  autocomplete on the ID).
- `/reminder cancel` — cancel a reminder.
- `/reminder list` — list all active reminders in the server with their next
  trigger time (rendered in each viewer's local time via Discord timestamps).
- `/set channel` — (Manage Server permission required) choose the channel
  reminders are posted in for that server.
- `/set view` — show the currently configured channel.
- Every firing reminder DMs the fixed owner (`OWNER_ID`, default
  `1227918600753512480`) **and** posts to the server's configured channel.
- Monthly/quarterly/yearly math is anchored to the original date so it never
  drifts (e.g. a reminder set for the 31st lands on the last day of shorter
  months, then returns to the 31st when the month allows it again).
- Only the reminder's creator, or someone with Manage Server, can edit or
  cancel it.
- Reminders survive restarts — they're persisted to a JSON file, and overdue
  reminders (e.g. the bot was offline) fire on the next check after startup.

## Setup

### 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   and create a new application.
2. Under **Bot**, create a bot user and copy its **token** (`DISCORD_TOKEN`).
3. Under **General Information**, copy the **Application ID**
   (`CLIENT_ID`).
4. Under **Bot**, no privileged gateway intents are required.
5. Generate an invite URL under **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `View Channels`, `Send Messages`, `Embed Links`
   Use the generated URL to invite the bot to your server.

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in:

| Variable         | Required | Description                                                                 |
| ---------------- | -------- | ---------------------------------------------------------------------------- |
| `DISCORD_TOKEN`  | Yes      | Your bot token.                                                              |
| `CLIENT_ID`      | Yes      | Your application ID (used to register slash commands).                      |
| `GUILD_ID`       | No       | Register commands to one guild only (instant) instead of globally (~1 hour). |
| `OWNER_ID`       | No       | Discord user ID to DM reminders to. Defaults to `1227918600753512480`.       |
| `DB_PATH`        | No       | Path to the JSON database file. Defaults to `./data/reminders.json`.        |

Slash commands are registered automatically every time the bot starts, so
there's no separate deploy step.

### 3. Run locally

```bash
npm install
npm start
```

## Deploying on Coolify

1. Create a new **Application** in Coolify, pointing at this repository. The
   `Dockerfile` at the repo root is picked up automatically.
2. Set the environment variables from the table above under the
   application's **Environment Variables** tab (`DISCORD_TOKEN` and
   `CLIENT_ID` are required).
3. Add a **persistent volume** mounted at `/app/data` so reminders survive
   redeploys (the Dockerfile already sets `DB_PATH=/app/data/reminders.json`
   and declares that path as a volume).
4. Deploy. Check the logs for `Logged in as <bot>#0000` and
   `Registered N application (/) command(s) globally.`

A `docker-compose.yml` is included for local testing of the same container
setup Coolify will run.

## Usage examples

```
/reminder set description:"Pay rent" frequency:Monthly date:2026-01-01 time:09:00 timezone:Europe/London
/reminder set description:"Renew car insurance" frequency:Yearly date:2026-03-15
/reminder set description:"Quarterly taxes" frequency:Quarterly date:2026-01-15 time:10:00
/reminder set description:"Dentist appointment" frequency:One-Time date:2026-10-02 time:14:30

/reminder list
/reminder edit id:3 date:2026-04-01
/reminder cancel id:3

/set channel channel:#reminders
/set view
```

- `date` must be `YYYY-MM-DD`.
- `time` is 24-hour `HH:mm` (defaults to `09:00` if omitted).
- `timezone` is any IANA timezone name, e.g. `America/New_York`,
  `Europe/London` (defaults to `UTC` if omitted).
