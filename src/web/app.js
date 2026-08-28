const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('../config');
const client = require('../bot/client');
const { BetaAllowlist, AppSettings } = require('../db/repo');
const { buildGenericInviteUrl } = require('./lib/discordOAuth');
const { requireAuth, requireGuildAccess, attachCsrf, verifyCsrf } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
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
const overviewRoutes = require('./routes/overview');

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
    // The sidebar's server switcher -- cheap in-memory filter of the OAuth
    // session's own guild list (no extra Discord/DB calls) down to servers
    // the bot is actually in, so the switcher never links to a 403/404.
    // Doesn't include guilds only reachable via a Permissions-page grant
    // (that list requires an async per-guild membership check, too slow to
    // do on every request) -- the home page's full list still covers those.
    const manageable = req.session?.manageableGuilds || [];
    res.locals.switcherGuilds = manageable.filter((g) => client.guilds.cache.has(g.id));
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

  // /admin was the original name -- redirect anyone with it bookmarked
  // rather than just 404ing on them. 307 keeps the method (and body, for a
  // POST mid-flight) instead of silently turning it into a GET.
  app.all(/^\/admin(\/.*)?$/, (req, res) => res.redirect(307, req.originalUrl.replace(/^\/admin/, '/staff')));

  app.use('/staff', requireAuth, (req, res, next) => {
    if (req.method === 'POST') return verifyCsrf(req, res, next);
    next();
  }, staffRoutes);

  app.use('/', requireAuth, dashboardRoutes);

  const guildRouter = express.Router({ mergeParams: true });
  guildRouter.use(overviewRoutes);
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
    res.locals.currentArea = req.path.split('/')[1] || null; // sidebar active-link highlight
    if (req.method === 'POST') return verifyCsrf(req, res, next);
    next();
  }, guildRouter);

  app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found.' });
  });

  return app;
}

module.exports = createApp;
