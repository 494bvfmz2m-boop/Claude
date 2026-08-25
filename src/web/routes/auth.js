const express = require('express');
const crypto = require('crypto');
const config = require('../../config');

const router = express.Router();

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

router.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.render('login', { error: null, csrfToken: res.locals.csrfToken });
});

router.post('/login', (req, res) => {
  const { password, _csrf } = req.body;
  if (!_csrf || _csrf !== req.session.csrfToken) {
    return res.render('login', { error: 'Form expired, try again.', csrfToken: res.locals.csrfToken });
  }
  if (typeof password === 'string' && safeEqual(password, config.adminPassword)) {
    req.session.authenticated = true;
    return res.redirect('/');
  }
  return res.render('login', { error: 'Wrong password.', csrfToken: res.locals.csrfToken });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
