const express = require('express');
const { getCpuStats, getMemStats, getDiskStats, formatBytes } = require('../../system/stats');
const { getContainers } = require('../../system/docker');

const router = express.Router();

const THRESHOLDS = { disk: 85, mem: 85, cpuLoadPerCore: 1.5 };

function buildHealth(cpu, mem, disk) {
  const issues = [];

  if (disk.available && disk.percent >= THRESHOLDS.disk) {
    issues.push(`Disk is ${disk.percent}% full — consider upgrading storage or clearing space.`);
  }
  if (mem.percent >= THRESHOLDS.mem) {
    issues.push(`Memory usage is at ${mem.percent}% — consider upgrading RAM or trimming running services.`);
  }
  if (cpu.load1 / cpu.cores >= THRESHOLDS.cpuLoadPerCore) {
    issues.push(`CPU load is high (${cpu.load1.toFixed(2)} over ${cpu.cores} core(s)) — consider upgrading CPU or spreading load out.`);
  }

  if (issues.length === 0) {
    return { level: 'ok', message: "You're comfortably within capacity — no upgrade needed right now.", issues: [] };
  }
  const level = issues.length >= 2 || disk.percent >= 95 || mem.percent >= 95 ? 'critical' : 'warning';
  return { level, message: issues.length === 1 ? issues[0] : `${issues.length} resources are under pressure.`, issues };
}

router.get('/', async (req, res) => {
  const cpu = getCpuStats();
  const mem = getMemStats();
  const disk = getDiskStats();
  const { available: dockerAvailable, error: dockerError, containers } = await getContainers();

  const health = buildHealth(cpu, mem, disk);

  res.render('dashboard', { cpu, mem, disk, containers, dockerAvailable, dockerError, health, formatBytes });
});

module.exports = router;
