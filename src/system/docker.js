const Docker = require('dockerode');
const config = require('../config');

const docker = new Docker({ socketPath: config.dockerSocketPath });

async function getContainerStats(id) {
  try {
    const container = docker.getContainer(id);
    const stats = await container.stats({ stream: false });

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const numCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
    const cpuPercent = systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

    return {
      cpuPercent: Math.round(cpuPercent * 10) / 10,
      memBytes: stats.memory_stats.usage || 0,
    };
  } catch (err) {
    return null;
  }
}

// vps-dashboard.name is a label you can set yourself in Coolify — no SSH needed:
// go to a resource's General settings -> Container Labels -> add
//   vps-dashboard.name=Whatever You Want
// and redeploy that resource. Checked first since it's always reliable.
// The coolify.* ones are best-effort guesses at Coolify's own labels; skip
// com.docker.compose.project — on Coolify's own internal containers that's
// just the literal word "source", not a useful name.
const NAME_LABEL_CANDIDATES = [
  'vps-dashboard.name',
  'coolify.name',
  'coolify.applicationName',
  'coolify.resourceName',
  'com.docker.compose.service',
];

function friendlyName(labels, hostname) {
  for (const key of NAME_LABEL_CANDIDATES) {
    const val = labels?.[key];
    if (val && val.trim()) return val.trim();
  }
  return hostname;
}

async function getContainers() {
  try {
    const raw = await docker.listContainers({ all: true });

    const containers = await Promise.all(raw.map(async (c) => {
      const hostname = (c.Names?.[0] || c.Id).replace(/^\//, '');
      const name = friendlyName(c.Labels, hostname);
      const base = {
        id: c.Id.slice(0, 12),
        name,
        hostname,
        image: c.Image,
        state: c.State,
        status: c.Status,
        createdAt: c.Created * 1000,
        stats: null,
      };
      if (c.State === 'running') {
        base.stats = await getContainerStats(c.Id);
      }
      return base;
    }));

    containers.sort((a, b) => a.name.localeCompare(b.name));

    return { available: true, containers };
  } catch (err) {
    return { available: false, error: err.message, containers: [] };
  }
}

module.exports = { getContainers };
