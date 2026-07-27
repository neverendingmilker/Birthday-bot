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

module.exports = {
  ValidationError,
  addBirthday,
  removeBirthday,
  getBirthday,
  setBirthdayRole,
  setRemoveAfterHours,
  getGuildConfig,
  // esposti per lo scheduler
  repo,
};
