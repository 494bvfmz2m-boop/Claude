const path = require('path');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const config = require('./config');
const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');
const { logger } = require('../src/utils/logger');

if (!config.sessionSecret || config.sessionSecret.length < 32) {
  logger.error('SESSION_SECRET is missing or too short (min 32 chars). Generate one with:');
  logger.error('  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}
if (!config.adminUsername || !config.adminPasswordHash) {
  logger.error('DASHBOARD_ADMIN_USERNAME / DASHBOARD_ADMIN_PASSWORD_HASH are not set.');
  logger.error('Generate a password hash with: npm run hash-password -- "your-password"');
  process.exit(1);
}
if (config.nodeEnv === 'production' && !config.url.startsWith('https://')) {
  logger.warn('NODE_ENV=production but DASHBOARD_URL is not https:// — secure cookies require HTTPS in front of this app.');
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '100kb' }));

app.use(session({
  name: 'dashboard.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    maxAge: 2 * 60 * 60 * 1000,
  },
}));

const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

app.use('/api/webhook', webhookRoutes);
app.use('/auth', generalLimiter, authRoutes);
app.use('/api', generalLimiter, requireAuth, apiRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.redirect(req.session?.authenticated ? '/dashboard.html' : '/login.html');
});

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Dashboard error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(config.port, () => {
  logger.info(`Dashboard listening on ${config.url}`);
});
