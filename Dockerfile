FROM node:20-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Piper (neural TTS engine) ---
RUN curl -fsSL -o /tmp/piper.tar.gz \
    https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz \
  && tar -xzf /tmp/piper.tar.gz -C /app \
  && rm /tmp/piper.tar.gz

# --- Voice models (medium quality, natural-sounding neural voices) ---
RUN mkdir -p /app/voices
RUN set -eu; \
  for entry in \
    "en_US lessac medium" \
    "en_US amy medium" \
    "en_US ryan medium" \
    "en_US kristin medium" \
    "en_GB alan medium" \
    "en_GB jenny_dioco medium" \
  ; do \
    set -- $entry; lang="$1"; name="$2"; quality="$3"; \
    id="${lang}-${name}-${quality}"; \
    base="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/${lang}/${name}/${quality}/${id}"; \
    curl -fsSL -o "/app/voices/${id}.onnx" "${base}.onnx"; \
    curl -fsSL -o "/app/voices/${id}.onnx.json" "${base}.onnx.json"; \
  done

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY public ./public

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
