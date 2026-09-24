const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const config = require('../config');
const { ensureCsrfToken, safeEqual } = require('../utils/csrf');
const { asyncHandler } = require('../utils/asyncHandler');
const { logger } = require('../../src/utils/logger');

const router = express.Router();

// A syntactically valid bcrypt hash that matches no real password, compared against
// when the configured username is wrong. This keeps failed-login timing consistent
// whether the username or the password was the wrong part, which helps resist
// username enumeration via timing analysis.
const DECOY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8Q2Ee4Z6t5aq/HzY6ep6q6aBshFGO2';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

router.get('/csrf', (req, res) => {
  res.json({ csrfToken: ensureCsrfToken(req) });
});

router.get('/session', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated), username: req.session?.username || null });
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { username, password, csrfToken } = req.body || {};

  if (!req.session.csrfToken || typeof csrfToken !== 'string' || !safeEqual(req.session.csrfToken, csrfToken)) {
    return res.status(403).json({ error: 'Your session expired. Refresh the page and try again.' });
  }
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Invalid username or password.' });
  }

  const usernameMatches = safeEqual(username, config.adminUsername);
  const hashToCheck = usernameMatches ? config.adminPasswordHash : DECOY_HASH;
  const passwordMatches = await bcrypt.compare(password, hashToCheck);

  if (!usernameMatches || !passwordMatches) {
    logger.warn(`Failed dashboard login attempt for username "${username}" from ${req.ip}`);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.regenerate((err) => {
    if (err) {
      logger.error('Session regenerate failed during login:', err);
      return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
    req.session.authenticated = true;
    req.session.username = username;
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    req.session.save((saveErr) => {
      if (saveErr) {
        logger.error('Session save failed during login:', saveErr);
        return res.status(500).json({ error: 'Login failed. Please try again.' });
      }
      logger.info(`Dashboard login succeeded for "${username}" from ${req.ip}`);
      res.json({ success: true, csrfToken: req.session.csrfToken });
    });
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('dashboard.sid');
    res.json({ success: true });
  });
});

module.exports = router;
