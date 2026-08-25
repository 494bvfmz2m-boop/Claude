require('dotenv').config();

function required(name, fallback) {
  const val = process.env[name];
  return val === undefined || val === '' ? fallback : val;
}

const parsedPort = parseInt(required('PORT', '3000'), 10);

module.exports = {
  adminPassword: required('ADMIN_PASSWORD', 'change-me'),
  sessionSecret: required('SESSION_SECRET', 'insecure-dev-secret'),
  port: Number.isNaN(parsedPort) ? 3000 : parsedPort,
  cookieSecure: required('COOKIE_SECURE', 'false') === 'true',
  dockerSocketPath: required('DOCKER_SOCKET_PATH', '/var/run/docker.sock'),
  hostRootPath: required('HOST_ROOT_PATH', '/hostfs'),
};
