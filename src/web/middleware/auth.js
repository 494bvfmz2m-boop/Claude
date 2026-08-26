const crypto = require('crypto');
const client = require('../../bot/client');
const { getMemberAccess } = require('../lib/dashboardAccess');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.redirect('/login');
}

// Discord OAuth logins are scoped to only the servers where that Discord
// user is the owner or has Manage Server there (the session-cached fast
// path below) -- but the Permissions page also lets an owner/Manage-Server
// holder grant specific *other* roles access to specific dashboard areas
// without touching that role's real Discord permissions. For anyone not in
// the fast-path list, fall back to a live check against the bot's own
// member/role data for that guild. req.dashboardAccess is set either way so
// requireArea() below can gate individual route groups by area.
async function requireGuildAccess(req, res, next) {
  if (!req.session || !req.session.authenticated) return res.redirect('/login');

  const guildId = req.params.guildId;
  const allowed = req.session.manageableGuilds || [];
  if (allowed.some((g) => g.id === guildId)) {
    req.dashboardAccess = { level: 'full', areas: null };
    return next();
  }

  const guild = client.guilds.cache.get(guildId);
  const access = await getMemberAccess(guild, req.session.discordUser?.id);
  if (access.level !== 'none') {
    req.dashboardAccess = access;
    return next();
  }

  return res.status(403).render('error', { message: "You don't have permission to manage that server. You need to be its owner, have Manage Server there, or be granted access from the Permissions page." });
}

// Gates one route group (tickets, embeds, moderation, etc.) by area. Must
// run after requireGuildAccess, which sets req.dashboardAccess.
function requireArea(area) {
  return (req, res, next) => {
    const access = req.dashboardAccess;
    if (access && (access.level === 'full' || (access.areas && access.areas.has(area)))) return next();
    return res.status(403).render('error', { message: "You don't have access to this section. Ask a server admin to grant it from the Permissions page." });
  };
}

function attachCsrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrf(req, res, next) {
  const token = req.body?._csrf;
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).send('Invalid or expired form token. Go back and try again.');
  }
  next();
}

module.exports = { requireAuth, requireGuildAccess, requireArea, attachCsrf, verifyCsrf };
