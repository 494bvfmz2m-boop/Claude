# Text to Speech Modal

A tiny, standalone text-to-speech tool: one modal, a text box, a voice picker, a **Speak** button, and an **Export** button to download the generated audio as a `.wav` file. No login, no accounts, no extra pages — just the modal.

Speech is generated server-side with [Piper](https://github.com/rhasspy/piper), a neural TTS engine — it sounds natural rather than robotic, ships as a self-contained binary (no API keys, no external service calls), and runs fully offline once deployed. Six voices are baked into the image at build time:

| Voice | Accent | Gender |
|---|---|---|
| Lessac | US | Male |
| Amy | US | Female |
| Ryan | US | Male |
| Kristin | US | Female |
| Alan | UK | Male |
| Jenny | UK | Female |

## Deploying on Coolify

1. Push this repo to a Git provider Coolify can reach.
2. In Coolify, create a new **Application** from this repository.
3. Build pack: **Dockerfile** (auto-detected from the `Dockerfile` in the repo root).
4. Set the exposed port to `3000` (or leave `PORT` env var default).
5. Deploy. That's it — no database, no env vars required.

Note: the Docker build downloads the Piper binary from GitHub and the voice models from Hugging Face, so the machine running the build needs outbound internet access to `github.com` and `huggingface.co`. After the build, the running container needs no network access at all.

## Running locally

```bash
docker build -t tts-modal .
docker run -p 3000:3000 tts-modal
```

Then open http://localhost:3000.

(There's no practical way to run this without Docker anymore, since Piper's voice models are baked into the image at build time — just use the Docker commands above.)

