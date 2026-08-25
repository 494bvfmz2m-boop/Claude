const Docker = require('dockerode');
const config = require('../config');

const docker = new Docker({ socketPath: config.dockerSocketPath });

async function getContainers() {
  try {
    const containers = await docker.listContainers({ all: true });
    return {
      available: true,
      containers: containers
        .map((c) => ({
          id: c.Id.slice(0, 12),
          name: (c.Names?.[0] || c.Id).replace(/^\//, ''),
          image: c.Image,
          state: c.State,
          status: c.Status,
          createdAt: c.Created * 1000,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (err) {
    return { available: false, error: err.message, containers: [] };
  }
}

module.exports = { getContainers };
