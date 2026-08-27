# Chaos Bot

A small, unhinged Discord bot. Slash commands:

- `/roast @user` — affectionate roast, no API key needed
- `/cursed` — pulls a random meme from a public meme API
- `/8ball <question>` — sarcastic magic 8-ball
- `/confess <text>` — anonymous confession posted to a configured channel

Plus optional idle chatter: every 45-90 minutes it drops a random weird line
into a configured channel, unprompted.

## Setup

1. Create an application + bot at https://discord.com/developers/applications
   - Bot tab -> Reset Token, copy it
   - OAuth2 -> URL Generator -> scopes: `bot`, `applications.commands`
     -> permissions: Send Messages, Embed Links, Read Message History
   - Use the generated URL to invite the bot to your server

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Configure:
   ```
   cp .env.example .env
   ```
   Fill in `DISCORD_TOKEN`. `CONFESS_CHANNEL_ID` and `CHAOS_CHANNEL_ID` are
   optional — right-click a channel in Discord (Developer Mode must be on
   in Settings -> Advanced) and "Copy Channel ID".

4. Run it:
   ```
   python bot.py
   ```

Slash commands sync automatically on startup (can take up to an hour to
appear globally the first time; per-server sync is usually instant if you
restrict `bot.tree.sync()` to a guild during development).

## Extending

- Swap the canned `ROASTS`/`EIGHT_BALL` lines in `cogs/chaos.py` for calls to
  an LLM API if you want dynamic, less repetitive responses.
- Add new commands as more `@app_commands.command` methods on the `Chaos`
  cog, or split them into new cogs under `cogs/` and load them in `bot.py`.
