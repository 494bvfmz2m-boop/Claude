# Claude
For my Claude projects

## Knowledge Galaxy

An interactive 3D map of markdown notes.

- `notes/`: 25 sample notes about a small coffee roastery, in 5 folders
- `build.py`: scans every `.md` file and writes `viewer/graph-data.js` (`const GRAPH = {nodes, links}`). Each node's `id` is its index in `nodes`.
- `viewer/index.html`: the 3D viewer, using 3d-force-graph from a CDN
- `server.py`: serves only `viewer/` on port 4700, plus `POST /chat` for Jarvis, the ask bar (typed or 🎙 voice, answers read aloud)
- Say or type **"remember that…"** (or "onthoud dat…") to file a note in `notes/captures/`. The new star is born next to its most related note.
- **H.O.L.O. interface** (`viewer/holo.css`, `viewer/holo.js`): a holographic HUD with a reactive core and a live readout. Say **"open settings"** (or click ⚙) for:
  - **Calendars**: private iCal links from Google, Outlook or iCloud, so Jarvis can answer schedule questions.
  - **Connected apps**: Email (SMTP), Telegram, Discord, Slack, Notion and a Webhook (n8n / Make / Zapier). Jarvis only ever writes **drafts**; you press Send or say "send it". Credentials stay server-side (`integrations.py`, in Postgres on Coolify).
- **Hands-free** (👂): say "Jarvis, …". It uses the browser's free speech recognition (Chrome or Edge), never your API key.
- **Performance**: Settings → Interface → Performance (Auto/High/Fast). Auto lowers detail on slow devices.
- `notes_store.py`: lets Jarvis create, edit, rename, move and delete notes, only inside `notes/`. Removed or overwritten notes go to `notes/.trash/`, and the **Undo** button reverts the last change.
- `config.json`: created on first run and git-ignored. Paste an Anthropic key (`sk-ant-...`) or a Google Gemini key (`AIza...` / `AQ....`) into `api_key`; the provider is detected from the key. Leave the placeholder to answer through `claude -p` on your Claude Code subscription.

```bash
python3 build.py            # or: python3 build.py /path/to/your/notes
python3 server.py           # then open http://localhost:4700
```

## Deploy on Coolify (use it on all your devices)

1. **Database:** a PostgreSQL resource in your Coolify project. Keep it Private; copy its *Postgres URL (internal)*.
2. **App:** in the same project and environment, + New → Private Repository (GitHub App) → this repo, branch `claude/cool-fermat-c7xwj1`, build pack **Dockerfile**, port **4700**. Set a domain, for example `https://jarvis.example.com`. HTTPS is required for the microphone.
3. **Environment variables** (runtime only; leave "available at build time" off):

| Variable | Value |
|---|---|
| `DATABASE_URL` | the database's internal Postgres URL |
| `JARVIS_PASSWORD` | the password for the login page (required) |
| `CLAUDE_CODE_OAUTH_TOKEN` | from `claude setup-token` on your PC, so Jarvis runs on your Claude subscription |
| `JARVIS_API_KEY` *(optional)* | an Anthropic or Gemini key instead, or in front of Claude |
| `SEED_SAMPLE_NOTES` *(optional)* | `0` to start with an empty database instead of the 25 sample notes |

The notes live in Postgres (`notes` table; removed notes go to `notes_trash`). Turn on Coolify's scheduled backups for the database. `/healthz` is the health check, and `/logout` signs you out.
