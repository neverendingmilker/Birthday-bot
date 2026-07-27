const repo = require('./birthdayRepository');

const GIORNI_PER_MESE = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // febbraio con margine bisestile

class ValidationError extends Error {}

function validateDate(day, month, year) {
  if (month < 1 || month > 12) {
    throw new ValidationError('Il mese deve essere un numero tra 1 e 12.');
  }
  if (day < 1 || day > GIORNI_PER_MESE[month - 1]) {
    throw new ValidationError(`Giorno non valido per il mese selezionato.`);
  }
  if (year !== null && year !== undefined) {
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      throw new ValidationError('Anno non valido.');
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
    throw new ValidationError('Il timer deve essere un numero intero di ore tra 1 e 720 (30 giorni).');
  }
  await repo.setRemoveAfterHours(guildId, hours);
}

async function getGuildConfig(guildId) {
  return repo.getGuildConfig(guildId);
}

const MESI_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Calcola la prossima data in cui cade il compleanno (oggi compreso) e quanti giorni mancano.
// Il 29 febbraio, negli anni non bisestili, viene festeggiato il 28.
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

// Tutti i compleanni del server, ordinati dal prossimo in arrivo e raggruppati per mese
// (il mese e' quello della PROSSIMA occorrenza, per gestire correttamente il cambio d'anno).
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
      groups.push({ monthLabel: MESI_IT[entry.date.getMonth()], entries: [] });
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
  // esposti per lo scheduler
  repo,
};
