# Music bot (FlaviBot-style)

A Discord music bot modelled on [FlaviBot](https://flavibot.xyz): slash commands, a "now playing" card with control buttons, filters, autoplay and 24/7 mode.

It is built with:

- **[discord.js](https://discord.js.org) v14** for the Discord side.
- **[Lavalink](https://lavalink.dev) v4** for audio. Lavalink is the standalone audio server most big music bots use. It does the searching, streaming and filtering, and the bot just tells it what to play.
- **[Shoukaku](https://github.com/shipgirlproject/Shoukaku)** to connect the two.

## Features

| | |
|---|---|
| **Sources** | YouTube, YouTube Music, SoundCloud, Bandcamp, Twitch, Vimeo and direct links. Spotify and Apple Music links work once you add API keys (see below). |
| **Playback** | `/play` (with search autocomplete and a `next` option), `/pause`, `/resume`, `/skip`, `/skipto`, `/previous`, `/seek`, `/stop`, `/leave` |
| **Queue** | `/queue`, `/shuffle`, `/loop` (off / track / queue), `/remove`, `/move`, `/clear` |
| **Extras** | `/volume` (0–150), `/filter` (bass boost, nightcore, vaporwave, 8D, karaoke, tremolo, vibrato, soft, slowed), `/autoplay` (keeps playing similar songs), `/247` (stays in the channel), `/nowplaying`, `/help` |
| **Buttons** | Previous, pause/resume, skip, loop and stop on every "now playing" message |
| **Housekeeping** | Leaves after `IDLE_TIMEOUT` seconds when the queue ends or the channel empties, unless 24/7 mode is on |

## Setup

### 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Under **Bot**, click **Reset Token** and copy the token. No privileged intents are needed.
3. Under **OAuth2 → URL Generator**, tick the `bot` and `applications.commands` scopes. Then tick the **Connect**, **Speak**, **Send Messages**, **Embed Links** and **View Channels** permissions. Open the generated URL to invite the bot.
4. Copy `.env.example` to `.env`. Fill in `DISCORD_TOKEN` and `CLIENT_ID` (the Application ID). Set `GUILD_ID` to your server's ID while testing, so commands show up instantly.

### 2a. Run with Docker (easiest)

```bash
cp .env.example .env    # then edit it
docker compose up -d lavalink
docker compose run --rm bot node src/deploy-commands.js   # register slash commands (once, and after adding commands)
docker compose up -d --build bot
docker compose logs -f
```

### 2b. Run without Docker

You need Node.js 22+ and Java 17+.

1. Download `Lavalink.jar` from the [Lavalink releases page](https://github.com/lavalink-devs/Lavalink/releases). Put it next to `lavalink/application.yml` and run `java -jar Lavalink.jar` from that folder.
2. In another terminal:

```bash
npm install
npm run deploy   # register slash commands
npm start
```

## Spotify and Apple Music

The [LavaSrc](https://github.com/topi314/LavaSrc) plugin reads the track info from these services and then plays the matching song from YouTube. This is the same approach other bots use.

- **Spotify:** create an app at the [Spotify developer dashboard](https://developer.spotify.com/dashboard). Then set `SPOTIFY_ENABLED=true`, `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in `.env`.
- **Apple Music:** set `APPLEMUSIC_ENABLED=true` and an `APPLEMUSIC_MEDIA_API_TOKEN`.

Restart Lavalink after changing these.

## Troubleshooting

- **"The audio server is not connected yet":** Lavalink isn't running, or `LAVALINK_URL` / `LAVALINK_PASSWORD` don't match `lavalink/application.yml`. On its first start, Lavalink downloads its plugins, which takes a little while.
- **YouTube tracks fail with "Sign in to confirm you're not a bot" or similar:** YouTube regularly blocks server IPs. Update the `youtube-plugin` version in `lavalink/application.yml`, or set up OAuth as described in the [youtube-source README](https://github.com/lavalink-devs/youtube-source#using-oauth-tokens).
- **Commands don't show up:** run the deploy step again. Global commands (no `GUILD_ID`) can take up to an hour to appear.

## Development

```bash
npm run check   # validates every slash command definition offline
npm test        # simulates playback events to test queue / loop / autoplay / idle logic
```

To add a command, add a file to `src/commands/` that exports `data` (a `SlashCommandBuilder`) and `execute(interaction)`. Then run `npm run deploy`.

| File | What it does |
|---|---|
| `src/index.js` | Discord client, interaction routing, voice-state handling |
| `src/music/MusicManager.js` | Lavalink connection, searching, queue advancement, autoplay, idle leave |
| `src/music/GuildQueue.js` | Per-server state (queue, history, loop, volume, 24/7…) |
| `src/music/ui.js` | Embeds and buttons |
| `src/music/filters.js` | Audio filter presets |

## Not included (yet)

FlaviBot also has a web dashboard and web player, saved playlists and premium tiers, and you could add lyrics on top. Those all need a database and/or a web server, which makes them good next steps.
