const express = require('express');
const { AppSettings, BetaAllowlist } = require('../../db/repo');

const router = express.Router();

function requireOwner(req, res, next) {
  if (!req.session || !req.session.isOwner) {
    return res.status(403).render('error', { message: 'Owner access only.' });
  }
  next();
}

router.get('/', requireOwner, (req, res) => {
  res.render('admin', {
    settings: AppSettings.get(),
    allowlist: BetaAllowlist.list(),
  });
});

router.post('/beta-lock', requireOwner, (req, res) => {
  AppSettings.setBetaLocked(req.body.enabled === 'on');
  res.redirect('/admin');
});

router.post('/allowlist/add', requireOwner, (req, res) => {
  const id = (req.body.discordUserId || '').trim();
  if (/^\d{5,25}$/.test(id)) BetaAllowlist.add(id);
  res.redirect('/admin');
});

router.post('/allowlist/remove', requireOwner, (req, res) => {
  BetaAllowlist.remove(req.body.discordUserId);
  res.redirect('/admin');
});

module.exports = router;
