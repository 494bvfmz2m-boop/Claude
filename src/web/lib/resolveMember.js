const DISCORD_ID = /^\d{5,25}$/;

// Web-only convenience: slash commands get Discord's own @mention picker, but
// a plain text box needs to accept a username too, not just a raw ID. Only
// works for someone currently in the server (banned/left users need their ID).
// Shared by the moderation "issue a punishment" form and the embed mention
// picker.
async function resolveMember(guild, input) {
  const raw = input.replace(/^@/, '');
  if (DISCORD_ID.test(raw)) {
    return guild.members.fetch(raw).catch(() => null);
  }
  const lower = raw.toLowerCase();
  const cached = guild.members.cache.find((m) =>
    m.user.username.toLowerCase() === lower ||
    m.user.tag.toLowerCase() === lower ||
    (m.nickname && m.nickname.toLowerCase() === lower));
  if (cached) return cached;

  const results = await guild.members.fetch({ query: raw, limit: 5 }).catch(() => null);
  if (!results || results.size === 0) return null;
  return results.find((m) => m.user.username.toLowerCase() === lower || (m.nickname && m.nickname.toLowerCase() === lower)) || results.first();
}

module.exports = { resolveMember, DISCORD_ID };
