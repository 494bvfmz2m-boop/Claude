require('dotenv').config();

module.exports = {
  port: process.env.DASHBOARD_PORT || 3000,
  url: process.env.DASHBOARD_URL || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET || '',
  adminUsername: process.env.DASHBOARD_ADMIN_USERNAME || '',
  adminPasswordHash: process.env.DASHBOARD_ADMIN_PASSWORD_HASH || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  orderWebhookSecret: process.env.ORDER_WEBHOOK_SECRET || '',
};
