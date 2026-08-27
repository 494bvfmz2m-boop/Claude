const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('../config');
const client = require('../bot/client');
const { BetaAllowlist, AppSettings } = require('../db/repo');
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
const permissionRoutes = require('./routes/permissions');
const tagRoutes = require('./routes/tags');
const announcementRoutes = require('./routes/announcements');
const giveawayRoutes = require('./routes/giveaways');
const eventRoutes = require('./routes/events');

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
    res.locals.isAdmin = Boolean(req.session?.isAdmin);
    res.locals.inviteUrl = buildGenericInviteUrl();
    const appSettings = AppSettings.get();
    res.locals.maintenance = { enabled: appSettings.maintenanceEnabled, message: appSettings.maintenanceMessage };
    next();
  });

  // Public, unauthenticated, read-only -- just an aggregate count so
  // modsentry.site (a separate static site) can show live beta availability
  // instead of a number someone has to update by hand.
  app.get('/api/beta-status', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
    const taken = BetaAllowlist.list().length;
    const total = config.betaTotalSlots;
    res.json({ taken, total, remaining: Math.max(0, total - taken) });
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
  guildRouter.use(permissionRoutes);
  guildRouter.use(tagRoutes);
  guildRouter.use(announcementRoutes);
  guildRouter.use(giveawayRoutes);
  guildRouter.use(eventRoutes);

  // CSRF check on every state-changing POST under the dashboard
  app.use('/dashboard/:guildId', requireGuildAccess, (req, res, next) => {
    res.locals.dashboardAccess = req.dashboardAccess; // so header.ejs can hide nav links the user can't reach
    if (req.method === 'POST') return verifyCsrf(req, res, next);
    next();
  }, guildRouter);

  app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found.' });
  });

  return app;
}

module.exports = createApp;
