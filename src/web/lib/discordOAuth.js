const config = require('../../config');

const DISCORD_API = 'https://discord.com/api/v10';
const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

// Same permission set the README's invite link grants: everything the bot
// needs for tickets + moderation, plus View Audit Log (needed to check who
// actually added the bot -- see bot/betaGate.js and bot/introduction.js),
// Create Instant Invite (lets the owner's DM server list hand back a working
// invite link for each server, and /invite -- see bot/ownerPanel.js and
// bot/qol.js), Manage Nicknames (needed for /afk and /nick -- see bot/afk.js
// and bot/moderation.js), Manage Expressions (needed for /steal to add
// emoji -- see bot/qol.js), and Manage Server (needed to suppress Discord's
// own "X joined the server" system message -- see bot/welcome.js and
// web/routes/settings.js). Used to build "invite XyphrosMod here" links for
// servers an OAuth user manages but hasn't added the bot to yet.
//
// Existing servers that invited the bot before Manage Nicknames, Manage
// Expressions, or Manage Server were added here need to re-invite/reauthorize
// it for /afk, /nick, /steal, or the join-message toggle to work; until then
// they just fail with a clear error instead of doing nothing.
const BOT_INVITE_PERMISSIONS = '1100988148919';

function buildBotInviteUrl(guildId) {
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    scope: 'bot applications.commands',
    permissions: BOT_INVITE_PERMISSIONS,
    guild_id: guildId,
    disable_guild_select: 'true',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

// Same invite, but with no server preselected — for the generic "Invite to
// Server" button, which lets the user pick any server they manage from
// Discord's own picker instead of us listing them one by one.
function buildGenericInviteUrl() {
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    scope: 'bot applications.commands',
    permissions: BOT_INVITE_PERMISSIONS,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.oauthRedirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    state,
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function exchangeCode(code) {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.discordClientId,
      client_secret: config.discordClientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.oauthRedirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Discord rejected the login (${res.status}). Try again.`);
  return res.json();
}

async function fetchDiscordUser(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Couldn't fetch your Discord profile (${res.status}).`);
  return res.json();
}

// Guilds where this user is the owner or has the Manage Server permission —
// the same bar Discord itself uses to decide who can configure a server's
// integrations, so it lines up with what people expect to be able to touch.
// Returns full {id, name, icon} objects (not just IDs) so the dashboard can
// also offer "invite the bot here" for ones it isn't in yet, without a
// second API call later.
async function fetchManageableGuilds(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Couldn't fetch your server list (${res.status}).`);
  const guilds = await res.json();
  return guilds
    .filter((g) => {
      if (g.owner) return true;
      const perms = BigInt(g.permissions);
      return (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD;
    })
    .map((g) => ({
      id: g.id,
      name: g.name,
      iconURL: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null,
    }));
}

module.exports = { buildAuthorizeUrl, buildBotInviteUrl, buildGenericInviteUrl, exchangeCode, fetchDiscordUser, fetchManageableGuilds };
