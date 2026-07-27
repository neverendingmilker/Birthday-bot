const db = require('../../database/db');

// --- Config del server (ruolo compleanno + timer di rimozione) ---

async function getGuildConfig(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM birthday_guild_config WHERE guild_id = ?',
    args: [guildId],
  });

  const row = result.rows[0];
  return row
    ? {
        guild_id: row.guild_id,
        birthday_role_id: row.birthday_role_id,
        remove_after_hours: Number(row.remove_after_hours),
      }
    : { guild_id: guildId, birthday_role_id: null, remove_after_hours: 24 };
}

async function setBirthdayRole(guildId, roleId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO birthday_guild_config (guild_id, birthday_role_id, remove_after_hours)
          VALUES (?, ?, 24)
          ON CONFLICT(guild_id) DO UPDATE SET birthday_role_id = excluded.birthday_role_id`,
    args: [guildId, roleId],
  });
}

async function setRemoveAfterHours(guildId, hours) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO birthday_guild_config (guild_id, birthday_role_id, remove_after_hours)
          VALUES (?, NULL, ?)
          ON CONFLICT(guild_id) DO UPDATE SET remove_after_hours = excluded.remove_after_hours`,
    args: [guildId, hours],
  });
}

// --- Compleanni utenti ---

async function upsertBirthday(guildId, userId, day, month, year) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO birthdays (guild_id, user_id, day, month, year)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(guild_id, user_id) DO UPDATE SET
            day = excluded.day, month = excluded.month, year = excluded.year`,
    args: [guildId, userId, day, month, year],
  });
}

async function getBirthday(guildId, userId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM birthdays WHERE guild_id = ? AND user_id = ?',
    args: [guildId, userId],
  });
  return result.rows[0] || null;
}

async function deleteBirthday(guildId, userId) {
  await db.ready;
  await db.client.execute({
    sql: 'DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?',
    args: [guildId, userId],
  });
}

// Tutti gli utenti che compiono gli anni oggi (day/month), su tutti i server
async function getBirthdaysForToday(day, month) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM birthdays WHERE day = ? AND month = ?',
    args: [day, month],
  });
  return result.rows;
}

// --- Assegnazioni attive del ruolo compleanno (per sapere quando rimuoverlo) ---

async function recordRoleAssignment(guildId, userId, assignedAt, yearAssigned) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO birthday_role_assignments (guild_id, user_id, assigned_at, year_assigned)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(guild_id, user_id) DO UPDATE SET
            assigned_at = excluded.assigned_at, year_assigned = excluded.year_assigned`,
    args: [guildId, userId, assignedAt, yearAssigned],
  });
}

async function getAllActiveAssignments() {
  await db.ready;
  const result = await db.client.execute('SELECT * FROM birthday_role_assignments');
  return result.rows;
}

async function removeRoleAssignment(guildId, userId) {
  await db.ready;
  await db.client.execute({
    sql: 'DELETE FROM birthday_role_assignments WHERE guild_id = ? AND user_id = ?',
    args: [guildId, userId],
  });
}

async function hasAssignmentThisYear(guildId, userId, year) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT 1 FROM birthday_role_assignments WHERE guild_id = ? AND user_id = ? AND year_assigned = ?',
    args: [guildId, userId, year],
  });
  return result.rows.length > 0;
}

module.exports = {
  getGuildConfig,
  setBirthdayRole,
  setRemoveAfterHours,
  upsertBirthday,
  getBirthday,
  deleteBirthday,
  getBirthdaysForToday,
  recordRoleAssignment,
  getAllActiveAssignments,
  removeRoleAssignment,
  hasAssignmentThisYear,
};
