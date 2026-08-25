const express = require('express');
const crypto = require('crypto');
const { buildAuthorizeUrl, exchangeCode, fetchDiscordUser, fetchManageableGuilds } = require('../lib/discordOAuth');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.render('login', { error: null });
});

router.get('/auth/discord', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(buildAuthorizeUrl(state));
});

router.get('/auth/discord/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const expectedState = req.session.oauthState;
  delete req.session.oauthState;

  if (oauthError) {
    return res.render('login', { error: 'Discord login was cancelled.' });
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return res.render('login', { error: 'Login expired or was tampered with — try again.' });
  }

  try {
    const token = await exchangeCode(code);
    const [user, manageableGuilds] = await Promise.all([
      fetchDiscordUser(token.access_token),
      fetchManageableGuilds(token.access_token),
    ]);

    req.session.authenticated = true;
    req.session.discordUser = { id: user.id, username: user.username, avatar: user.avatar };
    req.session.manageableGuilds = manageableGuilds;
    res.redirect('/');
  } catch (err) {
    res.render('login', { error: err.message || 'Discord login failed — try again.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
