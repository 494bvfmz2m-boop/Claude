FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV DB_PATH=/app/data/reminders.json

CMD ["node", "src/index.js"]
