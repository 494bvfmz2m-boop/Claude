# Text to Speech Modal

A tiny, standalone text-to-speech tool: one modal, a text box, a **Speak** button, and an **Export** button to download the generated audio as a `.wav` file. No login, no accounts, no extra pages — just the modal.

Speech is generated server-side with [espeak-ng](https://github.com/espeak-ng/espeak-ng) (open source, no API keys, no external service calls), so it works fully offline once deployed.

## Deploying on Coolify

1. Push this repo to a Git provider Coolify can reach.
2. In Coolify, create a new **Application** from this repository.
3. Build pack: **Dockerfile** (auto-detected from the `Dockerfile` in the repo root).
4. Set the exposed port to `3000` (or leave `PORT` env var default).
5. Deploy. That's it — no database, no env vars required.

## Running locally

```bash
docker build -t tts-modal .
docker run -p 3000:3000 tts-modal
```

Or without Docker (requires `espeak-ng` installed locally, e.g. `apt install espeak-ng` / `brew install espeak-ng`):

```bash
npm install
npm start
```

Then open http://localhost:3000.

