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

async function getContainers() {
  try {
    const raw = await docker.listContainers({ all: true });

    const containers = await Promise.all(raw.map(async (c) => {
      const base = {
        id: c.Id.slice(0, 12),
        name: (c.Names?.[0] || c.Id).replace(/^\//, ''),
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
