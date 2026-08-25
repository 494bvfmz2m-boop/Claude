const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('../config');
const { requireAuth, attachCsrf, verifyCsrf } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));

  app.use(session({
    name: 'vpsdash.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }));

  app.use(attachCsrf);

  app.use('/', authRoutes);

  app.use('/', requireAuth, (req, res, next) => {
    if (req.method === 'POST') return verifyCsrf(req, res, next);
    next();
  }, dashboardRoutes);

  app.use((req, res) => {
    res.status(404).send('Not found.');
  });

  return app;
}

module.exports = createApp;
