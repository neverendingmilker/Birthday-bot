const repo = require('./birthdayRepository');

const DAYS_PER_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Feb allows the leap-year margin

class ValidationError extends Error {}

function validateDate(day, month, year) {
  if (month < 1 || month > 12) {
    throw new ValidationError('Month must be a number between 1 and 12.');
  }
  if (day < 1 || day > DAYS_PER_MONTH[month - 1]) {
    throw new ValidationError('Invalid day for the selected month.');
  }
  if (year !== null && year !== undefined) {
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      throw new ValidationError('Invalid year.');
    }
  }
}

async function addBirthday(guildId, userId, day, month, year = null) {
  validateDate(day, month, year);
  await repo.upsertBirthday(guildId, userId, day, month, year);
}

async function removeBirthday(guildId, userId) {
  await repo.deleteBirthday(guildId, userId);
}

async function getBirthday(guildId, userId) {
  return repo.getBirthday(guildId, userId);
}

async function setBirthdayRole(guildId, roleId) {
  await repo.setBirthdayRole(guildId, roleId);
}

async function setRemoveAfterHours(guildId, hours) {
  if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 30) {
    throw new ValidationError('The timer must be a whole number of hours between 1 and 720 (30 days).');
  }
  await repo.setRemoveAfterHours(guildId, hours);
}

async function getGuildConfig(guildId) {
  return repo.getGuildConfig(guildId);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Computes the next date on which a birthday falls (today included) and how many days are left.
// February 29th, on non-leap years, is celebrated on the 28th.
function nextOccurrence(day, month, today) {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const buildDate = (year) => {
    const realDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
    return new Date(year, month - 1, realDay);
  };

  let candidate = buildDate(todayMidnight.getFullYear());
  if (candidate < todayMidnight) {
    candidate = buildDate(todayMidnight.getFullYear() + 1);
  }

  const daysUntil = Math.round((candidate - todayMidnight) / (1000 * 60 * 60 * 24));
  return { date: candidate, daysUntil };
}

// All birthdays in a guild, sorted by the soonest upcoming and grouped by month
// (the month of the NEXT occurrence, so the year rollover is handled correctly).
async function getUpcomingBirthdaysGroupedByMonth(guildId, today = new Date()) {
  const rows = await repo.getAllBirthdaysInGuild(guildId);

  const withDates = rows
    .map((row) => {
      const { date, daysUntil } = nextOccurrence(row.day, row.month, today);
      return { userId: row.user_id, date, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const groups = [];
  let currentKey = null;

  for (const entry of withDates) {
    const key = `${entry.date.getFullYear()}-${entry.date.getMonth()}`;
    if (key !== currentKey) {
      groups.push({ monthLabel: MONTH_NAMES[entry.date.getMonth()], entries: [] });
      currentKey = key;
    }
    groups[groups.length - 1].entries.push(entry);
  }

  return groups;
}

module.exports = {
  ValidationError,
  addBirthday,
  removeBirthday,
  getBirthday,
  setBirthdayRole,
  setRemoveAfterHours,
  getGuildConfig,
  getUpcomingBirthdaysGroupedByMonth,
  // exposed for the scheduler
  repo,
};
