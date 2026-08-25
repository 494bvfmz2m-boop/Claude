const os = require('os');
const fs = require('fs');
const config = require('../config');

function getCpuStats() {
  const cores = os.cpus().length;
  const [load1, load5, load15] = os.loadavg();
  return {
    cores,
    load1,
    load5,
    load15,
    // Load average is already "how many cores' worth of work is queued" on Linux,
    // so dividing by core count gives a rough 0-100%+ utilization figure.
    percent: Math.min(999, Math.round((load1 / cores) * 100)),
  };
}

function getMemStats() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  return {
    totalBytes,
    freeBytes,
    usedBytes,
    percent: Math.round((usedBytes / totalBytes) * 100),
  };
}

function getDiskStats() {
  try {
    const stat = fs.statfsSync(config.hostRootPath);
    const totalBytes = stat.blocks * stat.bsize;
    const freeBytes = stat.bfree * stat.bsize;
    const usedBytes = totalBytes - freeBytes;
    return {
      available: true,
      totalBytes,
      freeBytes,
      usedBytes,
      percent: Math.round((usedBytes / totalBytes) * 100),
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

module.exports = { getCpuStats, getMemStats, getDiskStats, formatBytes };
