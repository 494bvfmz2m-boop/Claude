# Builds EderveenGroup when this folder is the build context (Base Directory /ederveengroup).
# The Dockerfile at the repository root does the same from "/"; keep them in sync.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY . .
# Data (session key, settings, photos, 2FA) lives in a volume owned by the unprivileged node user.
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production DATA_DIR=/data TRUST_PROXY=1
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO /dev/null http://127.0.0.1:3000/mail/login || exit 1
CMD ["node", "server.js"]
