FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
# Snippets, reminders and reaction roles are saved in /app/data; mount a persistent volume there.
CMD ["node", "index.js"]
