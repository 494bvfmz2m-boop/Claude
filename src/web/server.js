const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const { ChannelType } = require('discord.js');
const config = require('../config');
const db = require('../db');

const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

function canManageGuild(discordGuild) {
  if (discordGuild.owner) return true;
  const permissions = BigInt(discordGuild.permissions);
  return (permissions & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.redirect('/login');
}

function getManageableGuildIds(req) {
  if (config.superAdminIds.includes(req.session.user.id)) {
    return null; // null = access to every server the bot is in
  }
  return req.session.manageableGuildIds || [];
}

function requireGuildAccess(req, res, next) {
  const allowed = getManageableGuildIds(req);
  if (allowed !== null && !allowed.includes(req.params.guildId)) {
    return res.status(403).json({
      error: "You don't have Manage Server permission in that server, or the bot isn't in it.",
    });
  }
  next();
}

function createServer(client) {
  const app = express();

  app.use(express.json());
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 * 12 },
    })
  );

  // --- Discord OAuth ---
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  app.get('/auth/discord', (req, res) => {
    if (!config.discordClientSecret || !config.discordRedirectUri) {
      return res.redirect(
        '/login?error=' +
          encodeURIComponent('Discord login is not configured (missing DISCORD_CLIENT_SECRET/DISCORD_REDIRECT_URI).')
      );
    }
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    const params = new URLSearchParams({
      client_id: config.discordClientId,
      redirect_uri: config.discordRedirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session.oauthState) {
      return res.redirect(
        '/login?error=' + encodeURIComponent('Invalid or expired login attempt. Please try again.')
      );
    }
    delete req.session.oauthState;

    try {
      const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.discordClientId,
          client_secret: config.discordClientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.discordRedirectUri,
        }),
      });
      if (!tokenRes.ok) throw new Error(`Token exchange failed (${tokenRes.status})`);
      const token = await tokenRes.json();

      const [userRes, guildsRes] = await Promise.all([
        fetch(`${DISCORD_API}/users/@me`, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        }),
        fetch(`${DISCORD_API}/users/@me/guilds`, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        }),
      ]);
      if (!userRes.ok || !guildsRes.ok) throw new Error('Failed to fetch Discord profile');

      const user = await userRes.json();
      const guilds = await guildsRes.json();

      req.session.user = { id: user.id, username: user.username, avatar: user.avatar };
      req.session.manageableGuildIds = guilds.filter(canManageGuild).map((g) => g.id);

      res.redirect('/');
    } catch (err) {
      console.error('Discord OAuth error:', err);
      res.redirect('/login?error=' + encodeURIComponent('Discord login failed. Please try again.'));
    }
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  // --- Dashboard (static, auth-gated) ---
  app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  app.use('/app.js', requireAuth, express.static(path.join(__dirname, 'public', 'app.js')));
  app.use('/style.css', express.static(path.join(__dirname, 'public', 'style.css')));

  // --- API ---
  app.use('/api', requireAuth);
  app.use('/api/guilds/:guildId', requireGuildAccess);

  app.get('/api/me', (req, res) => {
    res.json(req.session.user);
  });

  app.get('/api/status', (req, res) => {
    res.json({ botOnline: client.isReady(), botTag: client.isReady() ? client.user.tag : null });
  });

  app.get('/api/guilds', (req, res) => {
    const allowed = getManageableGuildIds(req);
    const guilds = [...client.guilds.cache.values()]
      .filter((g) => allowed === null || allowed.includes(g.id))
      .map((g) => ({ id: g.id, name: g.name }));
    res.json(guilds);
  });

  app.get('/api/guilds/:guildId/categories', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Bot is not in that server' });

    const channels = await guild.channels.fetch();
    const categories = [...channels.values()]
      .filter((c) => c && c.type === ChannelType.GuildCategory)
      .map((c) => ({ id: c.id, name: c.name }));

    const configured = db.listTicketCategories(guild.id);
    res.json({ available: categories, configured });
  });

  app.post('/api/guilds/:guildId/categories', (req, res) => {
    const { categoryId } = req.body || {};
    if (!categoryId) return res.status(400).json({ error: 'categoryId is required' });
    db.addTicketCategory(req.params.guildId, categoryId);
    res.json({ ok: true });
  });

  app.delete('/api/guilds/:guildId/categories/:categoryId', (req, res) => {
    db.removeTicketCategory(req.params.guildId, req.params.categoryId);
    res.json({ ok: true });
  });

  app.get('/api/guilds/:guildId/roles', (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Bot is not in that server' });
    const roles = [...guild.roles.cache.values()]
      .filter((r) => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name }));
    res.json(roles);
  });

  app.get('/api/guilds/:guildId/config', (req, res) => {
    res.json(db.getGuildConfig(req.params.guildId));
  });

  app.post('/api/guilds/:guildId/config', (req, res) => {
    const { supportRoleId } = req.body || {};
    db.setSupportRole(req.params.guildId, supportRoleId || null);
    res.json({ ok: true });
  });

  app.get('/api/guilds/:guildId/faq', (req, res) => {
    res.json(db.listFaqEntries(req.params.guildId));
  });

  app.post('/api/guilds/:guildId/faq', (req, res) => {
    const { question, keywords, answer } = req.body || {};
    if (!question || !answer) {
      return res.status(400).json({ error: 'question and answer are required' });
    }
    const id = db.addFaqEntry(req.params.guildId, { question, keywords, answer });
    res.json({ ok: true, id });
  });

  app.put('/api/guilds/:guildId/faq/:id', (req, res) => {
    const { question, keywords, answer } = req.body || {};
    if (!question || !answer) {
      return res.status(400).json({ error: 'question and answer are required' });
    }
    db.updateFaqEntry(req.params.guildId, Number(req.params.id), { question, keywords, answer });
    res.json({ ok: true });
  });

  app.delete('/api/guilds/:guildId/faq/:id', (req, res) => {
    db.deleteFaqEntry(req.params.guildId, Number(req.params.id));
    res.json({ ok: true });
  });

  return app;
}

module.exports = { createServer };
