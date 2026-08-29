const path = require('node:path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { ChannelType } = require('discord.js');
const config = require('../config');
const db = require('../db');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.redirect('/login');
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

  // --- Auth ---
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!config.dashboardPasswordHash) {
      return res.status(500).json({
        error:
          'DASHBOARD_PASSWORD_HASH is not set in .env. Run "npm run hash-password" and add the result to .env.',
      });
    }
    const validUser = username === config.dashboardUsername;
    const validPass = validUser && bcrypt.compareSync(password || '', config.dashboardPasswordHash);
    if (!validUser || !validPass) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    req.session.authenticated = true;
    res.json({ ok: true });
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

  app.get('/api/status', (req, res) => {
    res.json({ botOnline: client.isReady(), botTag: client.isReady() ? client.user.tag : null });
  });

  app.get('/api/guilds', (req, res) => {
    const guilds = [...client.guilds.cache.values()].map((g) => ({ id: g.id, name: g.name }));
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
