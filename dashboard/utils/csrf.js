const crypto = require('crypto');

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyCsrf(req, res, next) {
  const headerToken = req.get('x-csrf-token');
  if (!req.session.csrfToken || !headerToken || !safeEqual(req.session.csrfToken, headerToken)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token. Refresh the page and try again.' });
  }
  return next();
}

module.exports = { ensureCsrfToken, verifyCsrf, safeEqual };
