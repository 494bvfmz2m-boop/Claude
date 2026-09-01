const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('../config');
const { mainClient: client, allKnownGuilds } = require('../bot/clientRegistry');
const { BetaAllowlist, AppSettings } = require('../db/repo');
const { buildGenericInviteUrl } = require('./lib/discordOAuth');
const { verifyAndHandleTebexWebhook } = require('./lib/tebexWebhook');
const { getActiveTier, hasFeatureForGuild } = require('./lib/subscriptionGate');
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
const customBotRoutes = require('./routes/customBot');
const subscriptionRoutes = require('./routes/subscription');

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
    res.locals.hasStaffAccess = Boolean(req.session?.isOwner || req.session?.isAdmin || (req.session?.staffAreas?.length > 0));
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
    const knownGuildIds = new Set(allKnownGuilds().map((g) => g.id));
    res.locals.switcherGuilds = manageable.filter((g) => knownGuildIds.has(g.id));
    // Sitewide (not just under /dashboard/:guildId) since subscription
    // status/preview isn't guild-specific, and the "Previewing as X" banner
    // needs to show on every page the owner might be on -- see
    // staff.js's /tebex/preview routes and views/partials/header.ejs.
    res.locals.isPreviewingTier = Boolean(req.session?.isOwner && req.session?.previewTierId);
    res.locals.previewTier = res.locals.isPreviewingTier ? getActiveTier(null, req.session) : null;
    next();
  });

  // Public, unauthenticated, read-only -- just an aggregate count so
  // xyphros.site (a separate static site) can show live beta availability
  // instead of a number someone has to update by hand.
  app.get('/api/beta-status', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
    const taken = BetaAllowlist.list().length;
    const total = config.betaTotalSlots;
    res.json({ taken, total, remaining: Math.max(0, total - taken) });
  });

  // Public, server-to-server, verified by HMAC signature rather than a
  // session -- Tebex's own servers post here, there's no browser involved.
  // express.raw() (not the global express.urlencoded() above, which only
  // parses application/x-www-form-urlencoded and leaves this body alone)
  // keeps req.body as the exact bytes Tebex signed; re-serializing a parsed
  // copy before hashing would break signature verification.
  app.post('/webhooks/tebex', express.raw({ type: 'application/json', limit: '512kb' }), async (req, res) => {
    const result = await verifyAndHandleTebexWebhook(req.body, req.headers);
    if (result.json) return res.status(result.status).json(result.json);
    res.status(result.status).send(result.message);
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
  app.use('/', requireAuth, (req, res, next) => {
    if (req.method === 'POST') return verifyCsrf(req, res, next);
    next();
  }, subscriptionRoutes);

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
  guildRouter.use(customBotRoutes);

  // CSRF check on every state-changing POST under the dashboard
  app.use('/dashboard/:guildId', requireGuildAccess, (req, res, next) => {
    res.locals.dashboardAccess = req.dashboardAccess; // so header.ejs can hide nav links the user can't reach
    res.locals.currentArea = req.path.split('/')[1] || null; // sidebar active-link highlight
    res.locals.hasCustomBotFeature = hasFeatureForGuild(req.session?.discordUser?.id, 'custom_bot', req.params.guildId, req.session);
    if (req.method === 'POST') return verifyCsrf(req, res, next);
    next();
  }, guildRouter);

  app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found.' });
  });

  return app;
}

module.exports = createApp;
