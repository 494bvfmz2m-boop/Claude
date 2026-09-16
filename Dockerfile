# Single image, used for both the bot and the dashboard (see docker-compose.yml,
# which points each service at this same build with a different `command`).
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY dashboard ./dashboard
COPY scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app
USER node

VOLUME ["/app/data"]
EXPOSE 3000

CMD ["node", "src/index.js"]
