# VPS Dashboard

A small password-protected status page for the VPS itself: CPU/RAM/disk usage,
every Docker container/service running on the box, and a plain-language nudge
for when it's time to upgrade. Separate app from the ticket bot — deployed as
its own Coolify resource, its own domain, its own container — because it needs
broader access to the host (Docker socket, host filesystem) that the ticket
bot has no business having.

## What it needs to see the whole picture

CPU and memory numbers come from Node's `os` module, which reads `/proc` —
that's already host-wide by default in a normal Docker container, no extra
setup needed.

Two things **do** need extra container mounts, and the dashboard degrades
gracefully (shows a clear "not available" message) if you skip either:

1. **Docker socket** — to list every container/service on the VPS.
   Mount `/var/run/docker.sock` into the container at the same path.
2. **Host root filesystem** — to report the VPS's actual disk usage (a
   container's own filesystem is a small isolated layer, not the host's
   real disk). Mount `/` (read-only) into the container at `/hostfs`.

**Security note:** mounting the Docker socket gives this container the
practical equivalent of root on the VPS — anything that can talk to the
socket can create/inspect/kill any container, including ones with even
broader access. This is the same tradeoff every Docker-based monitoring tool
makes (Portainer, Dozzle, and Coolify itself all do this) — it's normal, but
worth knowing. Keep the `ADMIN_PASSWORD` strong for this app specifically.

## Deploying on Coolify

Lives in the same GitHub repo as the ticket bot, but on its own branch
(`claude/vps-dashboard`) — a different project, not a subfolder of the bot.

1. **New Resource** → **Public Repository** → same repo URL as the ticket bot,
   but **Branch**: `claude/vps-dashboard`.
2. **Base directory**: `/` (this branch has the app at the repo root).
3. **Build pack**: Dockerfile.
4. **Environment Variables**:
   ```
   ADMIN_PASSWORD=<a strong password>
   SESSION_SECRET=<a long random string>
   PORT=3000
   COOKIE_SECURE=false
   ```
5. **Persistent Storage** → add two volume mounts:
   - Name `docker-socket`, Source Path `/var/run/docker.sock`, Destination Path `/var/run/docker.sock`
   - Name `host-root`, Source Path `/`, Destination Path `/hostfs` (read-only if Coolify offers that option)
6. **Domain** → your chosen subdomain, with a matching DNS A record pointing
   at the VPS, same as the ticket bot.
7. **Deploy.**

That's it — no database, no Discord bot token, nothing else to configure.
