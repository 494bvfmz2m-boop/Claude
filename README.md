# Fun Bot

A Discord bot that's just there for fun — no purpose beyond novelty commands
and a lightweight coins economy to give people a reason to keep poking it.
Completely separate from the ticket bot and the VPS dashboard — its own
branch, own repo root, own container, own everything.

## What it does

Fourteen slash commands, no external APIs, no privileged Discord intents to
toggle — everything's self-contained:

**One-off novelty:**
- `/8ball <question>` — magic 8-ball
- `/coinflip` — heads or tails
- `/roll [dice]` — dice roller, e.g. `2d6`, `1d20` (defaults to `1d6`)
- `/rps <choice>` — rock/paper/scissors against the bot
- `/ship <user1> <user2>` — compatibility %, deterministic per pair (same two
  people always get the same result, order doesn't matter)
- `/roast [user]` — playful, harmless roast
- `/compliment [user]` — genuine compliment
- `/fact` — random weird/interesting fact
- `/wyr` — random "would you rather"
- `/vibecheck [user]` — random vibe meter with a caption

**Coins economy (gives it some staying power):**
- `/daily` — claim coins once every 20 hours
- `/balance [user]` — check a balance
- `/leaderboard` — top 10 richest in the server
- `/bet <amount>` — double-or-nothing coin flip against the house

## Deploying on Coolify

Same repo as the other two bots, own branch.

1. **New Resource** → **Public Repository** → same repo URL, **Branch**: `claude/fun-bot`
2. **Base directory**: `/`
3. **Build pack**: Dockerfile
4. **Environment Variables**:
   ```
   DISCORD_TOKEN=<your bot token>
   DISCORD_CLIENT_ID=<your client id>
   ```
5. **Persistent Storage** → one volume mount: Source Path empty, Destination Path `/app/data` (that's where the coins database lives — without this, balances reset on every redeploy)
6. **Important**: this bot has no web server at all — don't set a **Domain**, and if Coolify's **Healthcheck** is on by default, turn it off for this resource (there's no HTTP port for it to check, so it'll think the bot is unhealthy and restart-loop it — same failure mode as the port issues on the other two apps, avoid it here by just not enabling health checks/domains for this one).
7. **Deploy.**

No `PORT`, no `COOKIE_SECURE`, no dashboard password — there's no dashboard.
It's just a bot that logs in and responds to slash commands.

## Inviting it to your server

Bot needs no special permissions beyond the basics — just `applications.commands`
and `bot` scopes with **Send Messages** and **Use Application Commands**:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=2048
```

Commands register automatically per-server the moment the bot starts and
whenever it joins a new server — no manual registration step.
