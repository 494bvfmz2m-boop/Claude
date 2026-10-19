const path = require('path');

const env = (name) => process.env[name]?.trim() || null;

module.exports = {
  token: env('DISCORD_TOKEN'),
  forumId: env('DM_CHANNEL_ID'),
  staffRoleId: env('STAFF_ROLE_ID'),
  pingRoleId: env('PING_ROLE_ID'),
  // Coolify env vars are single-line, so allow "\n" for line breaks.
  autoReply: env('AUTO_REPLY')?.replace(/\\n/g, '\n') ?? null,
  anonymous: /^(1|true|yes|on)$/i.test(env('ANONYMOUS_REPLIES') ?? ''),
  dataDir: env('DATA_DIR') ?? path.join(__dirname, 'data'),
};
