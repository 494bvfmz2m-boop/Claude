const config = require('./config');

// Common English words that carry little meaning for matching a support
// question against an FAQ entry. Keeping this small and support-focused
// rather than a giant generic stopword list.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your',
  'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'and', 'or',
  'but', 'so', 'if', 'this', 'that', 'these', 'those', 'what', 'why',
  'how', 'when', 'where', 'who', 'not', 'have', 'has', 'had', 'im',
  'get', 'got', 'please', 'pls', 'thanks', 'thank',
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function entryTokens(entry) {
  const combined = `${entry.question} ${(entry.keywords || '').replace(/,/g, ' ')}`;
  return new Set(tokenize(combined));
}

function scoreQuery(queryTokens, entryTokenSet) {
  let overlap = 0;
  for (const token of queryTokens) {
    if (entryTokenSet.has(token)) overlap += 1;
  }
  const ratio = queryTokens.length ? overlap / queryTokens.length : 0;
  return { overlap, ratio };
}

/**
 * Finds the best matching FAQ entry for a free-text question.
 * Returns null when nothing clears the minimum overlap/ratio thresholds,
 * signalling the caller to escalate to a human instead of guessing.
 */
function findBestMatch(
  question,
  entries,
  {
    minOverlap = config.matchMinOverlap,
    minRatio = config.matchMinRatio,
  } = {}
) {
  const queryTokens = tokenize(question);
  if (queryTokens.length === 0 || entries.length === 0) return null;

  let best = null;
  for (const entry of entries) {
    const { overlap, ratio } = scoreQuery(queryTokens, entryTokens(entry));
    if (overlap === 0) continue;
    if (!best || overlap > best.overlap || (overlap === best.overlap && ratio > best.ratio)) {
      best = { entry, overlap, ratio };
    }
  }

  if (!best) return null;
  if (best.overlap < minOverlap || best.ratio < minRatio) return null;

  return best;
}

module.exports = { tokenize, findBestMatch };
