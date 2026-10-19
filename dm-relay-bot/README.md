# DM Relay Bot

Anyone who DMs the bot shows up in your relay channel. Use Discord's **Reply** on that message and the bot DMs your answer back to them (✅ = delivered, ❌ = failed).

## Setup

1. Developer Portal → your app → **Bot** → turn on **Message Content Intent**.
2. Create a channel (e.g. `#dms`), right-click it → **Copy Channel ID** (needs Developer Mode in Discord settings).
3. Make sure the bot can view, send messages, attach files, and add reactions in that channel.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token |
| `DM_CHANNEL_ID` | yes | Channel where DMs are posted |
| `STAFF_ROLE_ID` | no | Only members with this role can reply |

## Coolify

New resource → this repo → branch `claude/clever-archimedes-olnmg7`, build pack **Dockerfile**, base directory `/dm-relay-bot`. No ports needed. Add the env vars above and deploy.

## Local

```
npm install
DISCORD_TOKEN=... DM_CHANNEL_ID=... npm start
```
