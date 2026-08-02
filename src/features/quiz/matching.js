// Text normalization and "lenient" matching for the music quiz.
//
// Handles automatically:
// - upper/lowercase and accents
// - content in parentheses/brackets (e.g. "(feat. Someone)", "[Radio Edit]")
// - noise words: feat, ft, featuring, remix, remaster, version, live, radio edit, explicit
// - assorted punctuation
// - small typos (Levenshtein-based similarity ratio, no external dependency
//   needed — equivalent in spirit to Python's rapidfuzz.token_sort_ratio)

const NOISE_PATTERNS = [
  /\(.*?\)/g,
  /\[.*?\]/g,
  /\bfeat\.?\b.*/gi,
  /\bft\.?\b.*/gi,
  /\bfeaturing\b.*/gi,
  /\bremix\b/gi,
  /\bremaster(ed)?\b/gi,
  /\bradio edit\b/gi,
  /\bexplicit\b/gi,
  /\blive\b/gi,
  /\bversion\b/gi,
  /\bedit\b/gi,
  /-\s*$/g,
];

function stripAccents(text) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(text) {
  if (!text) return '';
  let result = text.toLowerCase();
  result = stripAccents(result);
  for (const pattern of NOISE_PATTERNS) {
    result = result.replace(pattern, ' ');
  }
  result = result.replace(/[^\w\s]/g, ' ');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

// Classic Levenshtein edit distance between two strings.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

// Ratio 0-100, similar in spirit to rapidfuzz's ratio: 100 = identical,
// 0 = completely different. Word order is normalized first (tokens sorted),
// mirroring rapidfuzz's token_sort_ratio so "Weeknd The" still matches "The Weeknd".
function tokenSortRatio(a, b) {
  const sortedA = a.split(/\s+/).filter(Boolean).sort().join(' ');
  const sortedB = b.split(/\s+/).filter(Boolean).sort().join(' ');
  const maxLen = Math.max(sortedA.length, sortedB.length);
  if (maxLen === 0) return 100;
  const distance = levenshtein(sortedA, sortedB);
  return Math.round((1 - distance / maxLen) * 100);
}

// True if 'guess' is close enough to 'target' to be considered correct.
function isCloseMatch(guess, target, threshold = 82) {
  const g = normalize(guess);
  const t = normalize(target);
  if (!g || !t) return false;
  if (g === t) return true;
  // Containment match (useful if someone only types part of the title/artist)
  if (g.length >= 3 && (t.includes(g) || g.includes(t))) return true;
  return tokenSortRatio(g, t) >= threshold;
}

// True if 'guess' matches any of the artists (main or featured).
function anyArtistMatch(guess, artists, threshold = 82) {
  return artists.some((artist) => isCloseMatch(guess, artist, threshold));
}

module.exports = { normalize, isCloseMatch, anyArtistMatch, tokenSortRatio, levenshtein };
