# DM Relay Bot

DMs to the bot show up as posts in a **forum channel**, one post per person, named after them. Anything you type in a post is DMed back to them.

- **Close** button: tags the post `Closed` and archives it. It reopens (tagged `Open`) when they DM again.
- **Delete** button: asks for confirmation, then deletes the post and its history. Their next DM starts a new post.
- Posts close automatically after 24 hours without activity.
- Start a message with `//` for an internal note that is **not** sent. `//close` and `//delete` also work as typed versions of the buttons; add a reason after them (`//close Resolved, thanks!`) and it gets DMed to the person first.
- If a DM can't be delivered (DMs closed, no shared server), the bot replies in the post with a warning.

Filter the forum by the `Open` tag to see only active conversations.

## Setup

1. Developer Portal → your app → **Bot** → turn on **Message Content Intent**.
2. Create a **forum** channel (e.g. `#dms`), right-click it → **Copy Channel ID** (needs Developer Mode in Discord settings).
3. In that forum, give the bot: View Channel, Send Messages, Create Posts, Send Messages in Posts, Manage Threads/Posts, Read Message History, Embed Links, Attach Files.
4. Either also give it **Manage Channels** so it creates the `Open`/`Closed` tags itself, or create those two tags yourself in the forum settings.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token |
| `DM_CHANNEL_ID` | yes | ID of the forum channel |
| `STAFF_ROLE_ID` | no | Only members with this role can reply and use the buttons |

## Coolify

New resource → this repo → branch `claude/clever-archimedes-olnmg7`, build pack **Dockerfile**, Base Directory `/dm-relay-bot`, Dockerfile Location `/Dockerfile`. No ports needed. Add the env vars above and deploy.

## Local

```
npm install
DISCORD_TOKEN=... DM_CHANNEL_ID=... npm start
```
