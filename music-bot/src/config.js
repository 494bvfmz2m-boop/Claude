import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export const config = {
  get token() { return required('DISCORD_TOKEN'); },
  get clientId() { return required('CLIENT_ID'); },
  guildId: process.env.GUILD_ID || null,
  lavalink: {
    url: process.env.LAVALINK_URL || 'http://localhost:2333',
    password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
  },
  defaultSearch: process.env.DEFAULT_SEARCH || 'ytmsearch',
  idleTimeoutMs: Number(process.env.IDLE_TIMEOUT ?? 180) * 1000,
  defaultVolume: Number(process.env.DEFAULT_VOLUME ?? 80),
  maxVolume: 150,
  embedColor: 0x8b5cf6,
};
