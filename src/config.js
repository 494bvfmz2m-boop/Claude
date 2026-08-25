require('dotenv').config();

function required(name, fallback) {
  return process.env[name] ?? fallback;
}

module.exports = {
  adminPassword: required('ADMIN_PASSWORD', 'change-me'),
  sessionSecret: required('SESSION_SECRET', 'insecure-dev-secret'),
  port: parseInt(required('PORT', '3000'), 10),
  cookieSecure: required('COOKIE_SECURE', 'false') === 'true',
  dockerSocketPath: required('DOCKER_SOCKET_PATH', '/var/run/docker.sock'),
  hostRootPath: required('HOST_ROOT_PATH', '/hostfs'),
};
