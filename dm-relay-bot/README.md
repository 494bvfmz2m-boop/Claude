# DM Relay Bot

When someone DMs the bot, it opens a thread named after them in your relay channel and posts their messages there. Anything you type in that thread gets DMed back to them. One thread per person; it's reused (and reopened if archived) when they message again.

- Start a message with `//` to leave an internal note that is **not** sent to the user.
- If a DM can't be delivered (DMs closed, no shared server), the bot replies in the thread with a warning.

## Setup

1. Developer Portal → your app → **Bot** → turn on **Message Content Intent**.
2. Create a text channel (e.g. `#dms`), right-click it → **Copy Channel ID** (needs Developer Mode in Discord settings).
3. In that channel, give the bot: View Channel, Send Messages, Create Public Threads, Send Messages in Threads, Read Message History, Embed Links, Attach Files.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token |
| `DM_CHANNEL_ID` | yes | Channel where the threads are created |
| `STAFF_ROLE_ID` | no | Only members with this role can reply |

## Coolify

New resource → this repo → branch `claude/clever-archimedes-olnmg7`, build pack **Dockerfile**, Base Directory `/dm-relay-bot`, Dockerfile Location `/Dockerfile`. No ports needed. Add the env vars above and deploy.

## Local

```
npm install
DISCORD_TOKEN=... DM_CHANNEL_ID=... npm start
```
