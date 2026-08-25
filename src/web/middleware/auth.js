const crypto = require('crypto');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.redirect('/login');
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

module.exports = { requireAuth, attachCsrf, verifyCsrf };
