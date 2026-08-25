FROM node:20-bookworm-slim

# better-sqlite3 needs build tools to compile its native binding
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV DB_PATH=/app/data/bot.sqlite
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/index.js"]
