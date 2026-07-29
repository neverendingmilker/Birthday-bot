const repo = require('./animeNightRepository');

class ValidationError extends Error {}

// Splits "Naruto, One Piece / Bleach" into ["Naruto", "One Piece", "Bleach"]
function splitTitles(rawInput) {
  return rawInput
    .split(/[,/]/)
    .map((title) => title.trim())
    .filter((title) => title.length > 0);
}

function formatISODate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Turns the ISO date stored in the DB (YYYY-MM-DD) back into DD/MM/YYYY for display.
function formatDisplayDate(isoDate) {
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// Accepts "DD/MM" or "DD/MM/YYYY"; defaults to today if nothing is given.
function parseWatchedDate(dateInput) {
  if (!dateInput) {
    return formatISODate(new Date());
  }

  const match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(dateInput.trim());
  if (!match) {
    throw new ValidationError('Invalid date format. Use DD/MM or DD/MM/YYYY, e.g. 23/10 or 23/10/2026.');
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();

  const date = new Date(year, month - 1, day);
  const isValidCalendarDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  if (!isValidCalendarDate) {
    throw new ValidationError('Invalid date.');
  }

  return formatISODate(date);
}

async function addAnime(guildId, rawTitles, dateInput, addedBy) {
  const titles = splitTitles(rawTitles);
  if (titles.length === 0) {
    throw new ValidationError('No valid anime titles found. Separate multiple titles with a comma or a slash.');
  }

  const watchedDate = parseWatchedDate(dateInput);
  await repo.addEntries(guildId, titles, watchedDate, addedBy);

  return { titles, watchedDate };
}

// order: 'alphabetical' (default) or 'date' (most recently watched first)
async function getSortedList(guildId, order) {
  const rows = await repo.getAllEntries(guildId);

  return [...rows].sort((a, b) => {
    if (order === 'date') {
      if (a.watched_date !== b.watched_date) return b.watched_date.localeCompare(a.watched_date);
      return a.title.localeCompare(b.title);
    }
    return a.title.localeCompare(b.title);
  });
}

async function getLast(guildId, count) {
  return repo.getLastEntries(guildId, count);
}

module.exports = {
  ValidationError,
  addAnime,
  getSortedList,
  getLast,
  formatDisplayDate,
};
