const { DateTime, IANAZone } = require('luxon');

const FREQUENCIES = {
  once: { label: 'One-Time', cycleMonths: null },
  monthly: { label: 'Monthly', cycleMonths: 1 },
  quarterly: { label: 'Quarterly', cycleMonths: 3 },
  yearly: { label: 'Yearly', cycleMonths: 12 },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidFrequency(freq) {
  return Object.prototype.hasOwnProperty.call(FREQUENCIES, freq);
}

function isValidTimezone(tz) {
  return IANAZone.isValidZone(tz);
}

/**
 * Parses a date + time + timezone into a Luxon DateTime.
 * Returns null if any part is malformed.
 */
function parseDateTime(dateStr, timeStr, timezone) {
  if (!DATE_RE.test(dateStr) || !TIME_RE.test(timeStr) || !isValidTimezone(timezone)) {
    return null;
  }
  const dt = DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: timezone });
  return dt.isValid ? dt : null;
}

/**
 * Computes the occurrence at `occurrenceIndex` for a reminder, always relative
 * to the original anchor date/time. Adding whole calendar months from a fixed
 * anchor (rather than repeatedly adding to the previous occurrence) avoids
 * drift for anchors like the 31st, which Luxon clamps to the last day of
 * shorter months.
 */
function computeOccurrence(anchorISO, timezone, frequency, occurrenceIndex) {
  const anchor = DateTime.fromISO(anchorISO, { zone: timezone });
  const freq = FREQUENCIES[frequency];
  if (frequency === 'once' || !freq.cycleMonths) return anchor;
  return anchor.plus({ months: freq.cycleMonths * occurrenceIndex });
}

/**
 * Finds the smallest occurrenceIndex (>= fromIndex) whose trigger time is
 * still in the future. Used both when creating a reminder (in case the
 * chosen date already passed) and when editing one.
 */
function findNextOccurrenceIndex(anchorISO, timezone, frequency, fromIndex = 0) {
  if (frequency === 'once') {
    const anchor = DateTime.fromISO(anchorISO, { zone: timezone });
    // 'once' has no series to advance through, so occurrenceIndex is used purely
    // as a past-due flag here: fromIndex means "still upcoming", fromIndex + 1
    // means "already elapsed" (callers reject creating/editing into the past).
    return anchor > DateTime.utc() ? fromIndex : fromIndex + 1;
  }
  let idx = fromIndex;
  const now = DateTime.utc();
  // Bounded loop: monthly/quarterly/yearly cycles converge in well under
  // a few hundred iterations even for anchors decades in the past.
  for (let i = 0; i < 10000; i++) {
    const occurrence = computeOccurrence(anchorISO, timezone, frequency, idx);
    if (occurrence > now) return idx;
    idx++;
  }
  return idx;
}

function toUnixSeconds(dt) {
  return Math.floor(dt.toSeconds());
}

module.exports = {
  FREQUENCIES,
  DATE_RE,
  TIME_RE,
  isValidFrequency,
  isValidTimezone,
  parseDateTime,
  computeOccurrence,
  findNextOccurrenceIndex,
  toUnixSeconds,
  DateTime,
};
