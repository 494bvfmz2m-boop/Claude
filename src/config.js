require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  databasePath: process.env.DATABASE_PATH || './data/bot.sqlite',
  orderWebhookSecret: process.env.ORDER_WEBHOOK_SECRET || null,
  colors: {
    primary: 0x5865f2,
    success: 0x57f287,
    danger: 0xed4245,
    warning: 0xfee75c,
    info: 0x5bc0de,
  },
};
