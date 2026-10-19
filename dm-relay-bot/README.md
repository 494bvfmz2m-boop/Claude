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

### Commands

All commands start by mentioning the bot (`@Bot`). `@Bot list` shows everything.

| Command | Where | What it does |
| --- | --- | --- |
| *(normal message)* | post | Sent to the person |
| `// text` | post | Internal note, not sent |
| `@Bot close [reason]` | post | Close; the reason is DMed to them |
| `@Bot delete [reason]` | post | Delete; the reason is DMed to them |
| `@Bot s <name>` | post | Send a saved snippet |
| `@Bot snippet add <name> <text>` | post | Save a snippet |
| `@Bot snippet remove <name>` | post | Delete a snippet |
| `@Bot snippets` | post | List snippets |
| `@Bot remind <time> [note]` | post | Ping you later if still open, e.g. `2h`, `1d12h` |
| `@Bot list` | anywhere | List all commands (auto-deletes) |
| `@Bot reaction roles` | anywhere | Reaction roles menu (needs Manage Roles) |

## Reaction roles

`@Bot reaction roles` opens a small menu (your command message is deleted):

- **Create new** opens a pop-up: title, optional description, and one line per role, e.g.
  ```
  🎮 Gamer
  🎨 Artist
  :pog: Announcements
  ```
  Paste normal emojis directly; for server emojis type their name like `:pog:`. The bot posts the message in that channel and adds the reactions.
- **Edit** / **Delete** let you pick one of the messages from a list.
- **Show all** lists every reaction-role message.

If something in the form is wrong, the bot says which line and gives a **Fix it** button that reopens the form with what you typed. All setup messages are only visible to you and disappear by themselves.

## Setup

1. Developer Portal → your app → **Bot** → turn on **Message Content Intent**.
2. Create a **forum** channel, right-click it → **Copy Channel ID** (needs Developer Mode).
3. Bot permissions in that forum: View Channel, Create Posts, Send Messages in Posts, Manage Threads/Posts, Read Message History, Embed Links, Attach Files. Add **Manage Channels** so it can create the `Open`/`Closed` tags, or make those tags yourself.
4. For reaction roles: give the bot **Manage Roles**, **Add Reactions** and **Read Message History**, and drag the bot's role **above** the roles it should hand out.
5. Give the bot **Manage Messages** so it can delete `@Bot list` / `@Bot reaction roles` command messages.

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
