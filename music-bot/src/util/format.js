export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Parses "90", "1:30" or "1:02:03" into milliseconds. Returns null if invalid. */
export function parseTimestamp(input) {
  const parts = input.trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0) * 1000;
}

export function progressBar(position, length, size = 16) {
  if (!length) return '🔴 LIVE';
  const ratio = Math.min(Math.max(position / length, 0), 1);
  const filled = Math.round(ratio * size);
  return '▬'.repeat(filled) + '🔘' + '▬'.repeat(size - filled);
}

export function trackLabel(track, max = 60) {
  const title = track.info.title.length > max ? `${track.info.title.slice(0, max - 1)}…` : track.info.title;
  const safe = title.replace(/[[\]]/g, '');
  return track.info.uri ? `[${safe}](${track.info.uri})` : safe;
}

export function trackLength(track) {
  return track.info.isStream ? 'LIVE' : formatDuration(track.info.length);
}
