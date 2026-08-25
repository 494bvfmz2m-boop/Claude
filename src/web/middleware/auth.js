const crypto = require('crypto');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.redirect('/login');
}

// Password logins keep full access to every server the bot is in (the
// original owner-admin behavior). Discord OAuth logins are scoped to only
// the servers where that Discord user is the owner or has Manage Server —
// so someone who invites the bot to their own server can configure it
// without being able to touch anyone else's.
function requireGuildAccess(req, res, next) {
  if (!req.session || !req.session.authenticated) return res.redirect('/login');
  if (req.session.authType === 'password') return next();

  const guildId = req.params.guildId;
  const allowed = req.session.manageableGuilds || [];
  if (allowed.some((g) => g.id === guildId)) return next();

  return res.status(403).render('error', { message: "You don't have permission to manage that server. You need to be its owner or have Manage Server there." });
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

module.exports = { requireAuth, requireGuildAccess, attachCsrf, verifyCsrf };
