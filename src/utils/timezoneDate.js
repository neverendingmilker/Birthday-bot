// Converts a local wall-clock date/time in a given IANA timezone into the correct UTC
// Date instant — handles DST/offset without needing an extra dependency.
function zonedTimeToUtc(year, monthIndex, day, hour, minute, second, timeZone) {
  const utcGuess = Date.UTC(year, monthIndex, day, hour, minute, second);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(utcGuess)).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );

  // Some locales render midnight as "24" instead of "00".
  const hourPart = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  const asIfUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hourPart, Number(parts.minute), Number(parts.second));
  const offsetMs = asIfUtc - utcGuess;

  return new Date(utcGuess - offsetMs);
}

// Midnight, January 1st of the current year, in the given IANA timezone (e.g. "Europe/Rome").
function startOfCurrentYear(timeZone) {
  const currentYear = Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(new Date()));
  return zonedTimeToUtc(currentYear, 0, 1, 0, 0, 0, timeZone);
}

module.exports = { zonedTimeToUtc, startOfCurrentYear };
