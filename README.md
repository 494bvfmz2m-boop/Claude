# ClipForge

A small self-hosted video editor — a bare-bones CapCut alternative you run on your own VPS.
Upload clips, trim/split them, arrange them on a timeline, add text overlays, and export an
MP4. Rendering happens server-side with ffmpeg.

## What it does (v1)

- Upload video clips into a project's media bin
- Add clips to a single-track timeline, drag to reorder
- Trim (in/out points) and split clips
- Add timed text overlays (position, size, color)
- Scrub/play a live preview in the browser
- Export to MP4 via a server-side ffmpeg render job, with progress polling and download
- Login for two accounts (both share all projects — this is a small shared tool, not a
  multi-tenant SaaS)

**Not included yet:** transitions, filters/color grading, multiple video tracks, background
music track, project resolution other than 1920×1080. The architecture (single video-track
`clips` table, `overlays` table, ffmpeg filter-graph render) is built so these can be added
later without a rewrite.

## Architecture

- **Next.js 15** (App Router) — single app, UI + API routes in one process
- **better-sqlite3** — one `clipforge.db` file, no separate DB service to run
- **ffmpeg / ffprobe** (CLI, via `child_process`) — trims, scales, concatenates clips and
  burns in text overlays with `drawtext`, using a single `-filter_complex` per render
- Renders run one at a time via an in-process queue (deliberately simple — no Redis/worker,
  appropriate for a small VPS with no GPU)
- Session auth is a signed HttpOnly cookie (JWT via `jose`), checked in `src/middleware.ts`;
  no OAuth/third-party auth — just the two accounts you configure via env vars
- All uploads and renders live under `/app/data` (one Docker volume) — back that volume up

## Local development

```bash
npm install
cp .env.example .env.local   # edit SESSION_SECRET / AUTH_USER_*/AUTH_PASS_*
npm run dev
```

You'll need `ffmpeg` and `ffprobe` on your PATH locally (`apt install ffmpeg` /
`brew install ffmpeg`).

## Deploying on your VPS with Coolify

This ships as a `Dockerfile`, which is the simplest path in Coolify (no Traefik labels to
manage, Coolify handles the domain/SSL/port mapping for you):

1. Push this repo to a Git provider Coolify can reach (or use Coolify's "deploy from a public
   repo" flow).
2. In Coolify: **New Resource → Application → your Git repo/branch**. Coolify will detect the
   `Dockerfile` build pack automatically.
3. Set **Port** to `3000`.
4. Under **Persistent Storage**, add a volume mounted at `/app/data` — this is where the
   SQLite database, uploaded clips, and rendered exports live. Without this, everything is
   lost on redeploy.
5. Under **Environment Variables**, set:
   - `SESSION_SECRET` — a long random string (`openssl rand -base64 32`)
   - `AUTH_USER_1` / `AUTH_PASS_1` — first account
   - `AUTH_USER_2` / `AUTH_PASS_2` — second account
6. Attach a domain and let Coolify issue SSL (Let's Encrypt) as usual.
7. Deploy. On first boot the app creates the SQLite schema and seeds the two accounts from
   the env vars above — the accounts are only (re)created if the `users` table is empty, so
   changing `AUTH_PASS_*` later won't retroactively update an existing user's password
   (delete the row from `data/clipforge.db` and redeploy if you need to reset one).

Alternatively, `docker-compose.yml` is included for local testing (`docker compose up
--build`) or if you'd rather deploy this as a Compose resource in Coolify.

### Sizing notes for a small VPS

- ffmpeg rendering is CPU-bound and single-threaded-ish per job; the built-in queue only runs
  one render at a time so a second export waits rather than fighting the first for CPU.
- `preset veryfast` is used for exports to keep render times reasonable without a GPU — bump
  it in `src/lib/render.ts` if you have CPU to spare and want smaller files.
- There's no upload size limit enforced by the app itself; your VPS's disk space is the limit.
