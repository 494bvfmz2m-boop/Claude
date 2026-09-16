const UNITS = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };

function parseDuration(input) {
  const match = /^(\d+)\s*(s|m|h|d|w)$/i.exec(input.trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  return value * UNITS[unit];
}

module.exports = { parseDuration };
