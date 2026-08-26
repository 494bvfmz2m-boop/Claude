const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('../config');
const client = require('../bot/client');
const { buildGenericInviteUrl } = require('./lib/discordOAuth');
const { requireAuth, requireGuildAccess, attachCsrf, verifyCsrf } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const ticketTypeRoutes = require('./routes/ticketTypes');
const panelRoutes = require('./routes/panels');
const settingsRoutes = require('./routes/settings');
const embedRoutes = require('./routes/embeds');
const moderationRoutes = require('./routes/moderation');
const mentionRoutes = require('./routes/mentions');
const reactionRoleRoutes = require('./routes/reactionRoles');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  app.use(session({
    name: 'ticketbot.sid',
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

  app.use((req, res, next) => {
    const ready = client.isReady();
    res.locals.botStatus = {
      ready,
      ping: ready && client.ws.ping >= 0 ? Math.round(client.ws.ping) : null,
      guildCount: ready ? client.guilds.cache.size : 0,
    };
    res.locals.discordUser = req.session?.discordUser || null;
    res.locals.isOwner = Boolean(req.session?.isOwner);
    res.locals.inviteUrl = buildGenericInviteUrl();
    next();
  });

  app.use('/', authRoutes);

  app.use('/admin', requireAuth, (req, res, next) => {
    if (req.method === 'POST') return verifyCsrf(req, res, next);
    next();
  }, adminRoutes);

  app.use('/', requireAuth, dashboardRoutes);

  const guildRouter = express.Router({ mergeParams: true });
  guildRouter.use(ticketTypeRoutes);
  guildRouter.use(panelRoutes);
  guildRouter.use(settingsRoutes);
  guildRouter.use(embedRoutes);
  guildRouter.use(moderationRoutes);
  guildRouter.use(mentionRoutes);
  guildRouter.use(reactionRoleRoutes);

  // CSRF check on every state-changing POST under the dashboard
  app.use('/dashboard/:guildId', requireGuildAccess, (req, res, next) => {
    if (req.method === 'POST') return verifyCsrf(req, res, next);
    next();
  }, guildRouter);

  app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found.' });
  });

  return app;
}

module.exports = createApp;
