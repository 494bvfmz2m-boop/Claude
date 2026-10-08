# One image, one container, one process tree: scripts/start.js runs both the
# bot and the dashboard together (see that file). This is deliberate — some
# hosts (Coolify's "Dockerfile"/"Application" deploy type among them) build
# this Dockerfile directly and ignore docker-compose.yml's service split, so
# the default CMD has to be self-sufficient on its own, in a single container.
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

CMD ["node", "scripts/start.js"]
