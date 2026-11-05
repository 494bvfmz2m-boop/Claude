# Knowledge Galaxy + Jarvis, ready for Coolify (or any Docker host).
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=4700

# Claude Code CLI, so Jarvis can answer on a Claude subscription via `claude -p`
# (authenticate with the CLAUDE_CODE_OAUTH_TOKEN env var from `claude setup-token`).
# Build with --build-arg INSTALL_CLAUDE_CODE=0 to skip it if you only use an API key.
ARG INSTALL_CLAUDE_CODE=1

RUN useradd --create-home --uid 1000 jarvis \
 && if [ "$INSTALL_CLAUDE_CODE" = "1" ]; then \
      apt-get update \
      && apt-get install -y --no-install-recommends curl ca-certificates \
      && rm -rf /var/lib/apt/lists/*; \
    fi

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

USER jarvis
RUN if [ "$INSTALL_CLAUDE_CODE" = "1" ]; then curl -fsSL https://claude.ai/install.sh | bash; fi
ENV PATH="/home/jarvis/.local/bin:${PATH}"

COPY --chown=jarvis:jarvis . .
USER root
RUN chown jarvis:jarvis /app
USER jarvis

EXPOSE 4700
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4700/healthz', timeout=4)"

CMD ["python", "server.py"]
