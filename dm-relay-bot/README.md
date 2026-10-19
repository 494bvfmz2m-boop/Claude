# DM Relay Bot

A modmail bot: DMs to the bot become posts in a **forum channel**, one post per person. Anything staff type in a post is DMed back. Also does reaction roles.

## Modmail

- Each post starts with a **user info card** (account age, when they joined, their roles) and three buttons:
  - 🙋 **Claim**: marks you as handling it. Click again to release; someone else clicking takes it over.
  - 🔒 **Close**: tags it `Closed` and archives it. It reopens when they DM again.
  - 🗑️ **Delete**: asks to confirm, then deletes the post.
- Posts close by themselves after 24 hours without activity. Filter the forum by the `Open` tag to see active ones.
- Replies are sent as **YourName:** message, or without a name if `ANONYMOUS_REPLIES=true`.
- Optional: ping a role on new conversations (`PING_ROLE_ID`) and send an automatic reply (`AUTO_REPLY`).

### Commands inside a post

| Command | What it does |
| --- | --- |
| *(normal message)* | Sent to the person |
| `// text` | Internal note, not sent |
| `//close [reason]` | Close; the reason is DMed to them |
| `//delete [reason]` | Delete; the reason is DMed to them |
| `//s <name>` | Send a saved snippet |
| `//snippet add <name> <text>` | Save a snippet |
| `//snippet remove <name>` | Delete a snippet |
| `//snippets` | List snippets |
| `//remind <time> [note]` | Ping you later if the post is still open, e.g. `//remind 2h`, `//remind 1d12h` |
| `//help` | Show this list |

## Reaction roles

Type `//reaction roles` in any channel (needs **Manage Roles**). A setup panel opens:

1. **Set up a message** → paste the message ID or link.
2. Pick a role from the menu, then **react to the panel** with the emoji for it (custom server emojis work).
3. Repeat for more roles, then **Save**. The bot adds the reactions to the message.

Run it on the same message again to edit it. **Remove from a message** and **Show all** are on the first screen.

## Setup

1. Developer Portal → your app → **Bot** → turn on **Message Content Intent**.
2. Create a **forum** channel, right-click it → **Copy Channel ID** (needs Developer Mode).
3. Bot permissions in that forum: View Channel, Create Posts, Send Messages in Posts, Manage Threads/Posts, Read Message History, Embed Links, Attach Files. Add **Manage Channels** so it can create the `Open`/`Closed` tags, or make those tags yourself.
4. For reaction roles: give the bot **Manage Roles**, **Add Reactions** and **Read Message History**, and drag the bot's role **above** the roles it should hand out.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token |
| `DM_CHANNEL_ID` | yes | Forum channel ID |
| `STAFF_ROLE_ID` | no | Only this role can reply and use the buttons |
| `PING_ROLE_ID` | no | Role pinged for new/reopened conversations |
| `AUTO_REPLY` | no | Automatic first reply. `\n` = new line |
| `ANONYMOUS_REPLIES` | no | `true` to hide staff names |

## Coolify

New resource → this repo → branch `claude/clever-archimedes-olnmg7`, build pack **Dockerfile**, Base Directory `/dm-relay-bot`, Dockerfile Location `/Dockerfile`. No ports needed.

**Persistent storage:** under the app's **Persistent Storage**, add a **Volume Mount** with destination path `/app/data`. Snippets, reminders and reaction roles are saved there; without it they're lost on every redeploy.

## Local

```
npm install
DISCORD_TOKEN=... DM_CHANNEL_ID=... npm start
```
