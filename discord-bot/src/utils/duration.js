const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 };
const UNIT_LABELS = { s: 'seconds', m: 'minutes', h: 'hours', d: 'days' };

// Parses strings like "10s", "5m", "24h", "3d" into a number of seconds.
function parseDurationToSeconds(input) {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(String(input).trim());

  if (!match) {
    throw new Error(
      'Invalid format. Use a number followed by s (seconds), m (minutes), h (hours) or d (days) — e.g. 30s, 10m, 24h, 3d.'
    );
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  return amount * UNIT_SECONDS[unit];
}

// Turns a number of seconds back into a compact, human-readable string, e.g. "1d 2h 5m".
function formatSeconds(totalSeconds) {
  const order = ['d', 'h', 'm', 's'];
  const parts = [];
  let remaining = totalSeconds;

  for (const unit of order) {
    const size = UNIT_SECONDS[unit];
    if (remaining >= size) {
      const value = Math.floor(remaining / size);
      parts.push(`${value}${unit}`);
      remaining -= value * size;
    }
  }

  return parts.length > 0 ? parts.join(' ') : '0s';
}

module.exports = { parseDurationToSeconds, formatSeconds, UNIT_LABELS };
