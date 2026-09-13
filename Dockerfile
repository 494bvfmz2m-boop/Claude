# ---- Build stage ----
FROM rust:1-slim-bookworm AS builder

# SQLite is compiled from source (sqlx's "bundled" feature) — only a C
# toolchain is needed, no system sqlite package.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN cargo build --release -p vault-server

# ---- Runtime stage ----
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 vault \
    && mkdir -p /data && chown vault:vault /data

WORKDIR /app
COPY --from=builder /app/target/release/vault-server /app/vault-server

# Bind to all interfaces inside the container — Coolify's proxy (Traefik)
# terminates TLS in front and forwards plain HTTP here, so this stays safe
# as long as the container itself is never exposed directly to the internet.
ENV VAULT_BIND_ADDR=0.0.0.0:7878
ENV VAULT_DB_PATH=/data/vault.db

VOLUME ["/data"]
EXPOSE 7878

USER vault
ENTRYPOINT ["/app/vault-server"]
