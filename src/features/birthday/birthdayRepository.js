const db = require('../../database/db');

const DEFAULT_REMOVE_AFTER_SECONDS = 86400; // 24h

// --- Guild config (birthday role + removal timer + greeting channel) ---

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
        remove_after_seconds: Number(row.remove_after_seconds ?? DEFAULT_REMOVE_AFTER_SECONDS),
        birthday_channel_id: row.birthday_channel_id,
      }
    : {
        guild_id: guildId,
        birthday_role_id: null,
        remove_after_seconds: DEFAULT_REMOVE_AFTER_SECONDS,
        birthday_channel_id: null,
      };
}

async function setBirthdayRole(guildId, roleId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO birthday_guild_config (guild_id, birthday_role_id, remove_after_seconds, birthday_channel_id)
          VALUES (?, ?, ${DEFAULT_REMOVE_AFTER_SECONDS}, NULL)
          ON CONFLICT(guild_id) DO UPDATE SET birthday_role_id = excluded.birthday_role_id`,
    args: [guildId, roleId],
  });
}

async function setRemoveAfterSeconds(guildId, seconds) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO birthday_guild_config (guild_id, birthday_role_id, remove_after_seconds, birthday_channel_id)
          VALUES (?, NULL, ?, NULL)
          ON CONFLICT(guild_id) DO UPDATE SET remove_after_seconds = excluded.remove_after_seconds`,
    args: [guildId, seconds],
  });
}

async function setBirthdayChannel(guildId, channelId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO birthday_guild_config (guild_id, birthday_role_id, remove_after_seconds, birthday_channel_id)
          VALUES (?, NULL, ${DEFAULT_REMOVE_AFTER_SECONDS}, ?)
          ON CONFLICT(guild_id) DO UPDATE SET birthday_channel_id = excluded.birthday_channel_id`,
    args: [guildId, channelId],
  });
}

async function isEnabled(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT enabled FROM birthday_guild_config WHERE guild_id = ?',
    args: [guildId],
  });
  const row = result.rows[0];
  return row ? Boolean(row.enabled) : true; // enabled by default until explicitly toggled off
}

async function setEnabled(guildId, enabled) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO birthday_guild_config (guild_id, remove_after_seconds, enabled)
          VALUES (?, ${DEFAULT_REMOVE_AFTER_SECONDS}, ?)
          ON CONFLICT(guild_id) DO UPDATE SET enabled = excluded.enabled`,
    args: [guildId, enabled ? 1 : 0],
  });
}

// --- User birthdays ---

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

// All users celebrating today (day/month), across every guild
async function getBirthdaysForToday(day, month) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM birthdays WHERE day = ? AND month = ?',
    args: [day, month],
  });
  return result.rows;
}

// All birthdays saved in ONE guild (used by /birthday list)
async function getAllBirthdaysInGuild(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM birthdays WHERE guild_id = ?',
    args: [guildId],
  });
  return result.rows;
}

// --- Active birthday role assignments (to know when to remove them) ---

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

// --- Birthday greetings already sent (tracked separately from the role, so a
// greeting can still fire even in servers with no birthday role configured) ---

async function hasGreetedThisYear(guildId, userId, year) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT 1 FROM birthday_greetings WHERE guild_id = ? AND user_id = ? AND year_greeted = ?',
    args: [guildId, userId, year],
  });
  return result.rows.length > 0;
}

async function recordGreeting(guildId, userId, year) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO birthday_greetings (guild_id, user_id, year_greeted)
          VALUES (?, ?, ?)
          ON CONFLICT(guild_id, user_id) DO UPDATE SET year_greeted = excluded.year_greeted`,
    args: [guildId, userId, year],
  });
}

module.exports = {
  getGuildConfig,
  isEnabled,
  setEnabled,
  setBirthdayRole,
  setRemoveAfterSeconds,
  setBirthdayChannel,
  upsertBirthday,
  getBirthday,
  deleteBirthday,
  getBirthdaysForToday,
  getAllBirthdaysInGuild,
  recordRoleAssignment,
  getAllActiveAssignments,
  removeRoleAssignment,
  hasAssignmentThisYear,
  hasGreetedThisYear,
  recordGreeting,
};
