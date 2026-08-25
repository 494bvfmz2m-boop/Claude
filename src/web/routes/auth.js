const express = require('express');
const crypto = require('crypto');
const config = require('../../config');
const { buildAuthorizeUrl, exchangeCode, fetchDiscordUser, fetchManageableGuilds } = require('../lib/discordOAuth');

const router = express.Router();

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

router.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.render('login', { error: null, csrfToken: res.locals.csrfToken, oauthEnabled: config.oauthEnabled });
});

router.post('/login', (req, res) => {
  const { password, _csrf } = req.body;
  if (!_csrf || _csrf !== req.session.csrfToken) {
    return res.render('login', { error: 'Form expired, try again.', csrfToken: res.locals.csrfToken, oauthEnabled: config.oauthEnabled });
  }
  if (typeof password === 'string' && safeEqual(password, config.adminPassword)) {
    req.session.authenticated = true;
    req.session.authType = 'password';
    return res.redirect('/');
  }
  return res.render('login', { error: 'Wrong password.', csrfToken: res.locals.csrfToken, oauthEnabled: config.oauthEnabled });
});

router.get('/auth/discord', (req, res) => {
  if (!config.oauthEnabled) return res.status(404).render('error', { message: 'Discord login is not configured on this deployment.' });
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(buildAuthorizeUrl(state));
});

router.get('/auth/discord/callback', async (req, res) => {
  if (!config.oauthEnabled) return res.status(404).render('error', { message: 'Discord login is not configured on this deployment.' });

  const { code, state, error: oauthError } = req.query;
  const expectedState = req.session.oauthState;
  delete req.session.oauthState;

  if (oauthError) {
    return res.render('login', { error: 'Discord login was cancelled.', csrfToken: res.locals.csrfToken, oauthEnabled: true });
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return res.render('login', { error: 'Login expired or was tampered with — try again.', csrfToken: res.locals.csrfToken, oauthEnabled: true });
  }

  try {
    const token = await exchangeCode(code);
    const [user, manageableGuilds] = await Promise.all([
      fetchDiscordUser(token.access_token),
      fetchManageableGuilds(token.access_token),
    ]);

    req.session.authenticated = true;
    req.session.authType = 'oauth';
    req.session.discordUser = { id: user.id, username: user.username, avatar: user.avatar };
    req.session.manageableGuilds = manageableGuilds;
    res.redirect('/');
  } catch (err) {
    res.render('login', { error: err.message || 'Discord login failed — try again.', csrfToken: res.locals.csrfToken, oauthEnabled: true });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
