const express = require('express');
const crypto = require('crypto');
const config = require('../../config');
const { buildAuthorizeUrl, exchangeCode, fetchDiscordUser, fetchManageableGuilds } = require('../lib/discordOAuth');
const { AppSettings, BetaAllowlist, BetaRequests, DashboardAdmins } = require('../../db/repo');
const client = require('../../bot/client');
const { notifyAdmins } = require('../../bot/betaRequests');
const { verifyCsrf } = require('../middleware/auth');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  const pendingBetaUser = req.session.pendingBetaUser || null;
  const alreadyRequested = pendingBetaUser ? BetaRequests.hasPending(pendingBetaUser.id) : false;
  res.render('login', { error: null, pendingBetaUser, alreadyRequested });
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

    const isOwner = Boolean(config.ownerDiscordId) && user.id === config.ownerDiscordId;
    const isAdmin = isOwner || DashboardAdmins.has(user.id);
    if (!isAdmin && AppSettings.get().betaLocked && !BetaAllowlist.has(user.id)) {
      // Stash who they are (without granting a real session) so the login
      // page can offer "Request access" without making them go through
      // Discord OAuth a second time just to submit it.
      req.session.pendingBetaUser = { id: user.id, username: user.username, avatar: user.avatar };
      return res.redirect('/login');
    }

    req.session.authenticated = true;
    req.session.discordUser = { id: user.id, username: user.username, avatar: user.avatar };
    req.session.isOwner = isOwner;
    req.session.isAdmin = isAdmin;
    req.session.manageableGuilds = manageableGuilds;
    res.redirect('/');
  } catch (err) {
    res.render('login', { error: err.message || 'Discord login failed — try again.' });
  }
});

router.post('/request-access', verifyCsrf, async (req, res) => {
  const pendingBetaUser = req.session.pendingBetaUser;
  if (!pendingBetaUser) return res.redirect('/login');

  if (!BetaRequests.hasPending(pendingBetaUser.id)) {
    const message = (req.body.message || '').trim().slice(0, 500);
    const id = BetaRequests.create(pendingBetaUser.id, pendingBetaUser.username, message);
    await notifyAdmins(client, {
      id, discordUserId: pendingBetaUser.id, discordTag: pendingBetaUser.username, message,
    }).catch(() => {});
  }
  res.redirect('/login');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
