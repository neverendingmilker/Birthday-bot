const db = require('../../database/db');

// --- Feature on/off toggle (per guild) ---

async function isEnabled(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT enabled FROM custom_role_config WHERE guild_id = ?',
    args: [guildId],
  });
  const row = result.rows[0];
  return row ? Number(row.enabled) === 1 : true; // enabled by default until explicitly toggled off
}

async function setEnabled(guildId, enabled) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO custom_role_config (guild_id, enabled)
          VALUES (?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET enabled = excluded.enabled`,
    args: [guildId, enabled ? 1 : 0],
  });
}

// --- User <-> custom role links ---

async function addLink(guildId, userId, roleId, createdBy) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO custom_role_links (guild_id, user_id, role_id, created_by, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(guild_id, user_id, role_id) DO UPDATE SET
            created_by = excluded.created_by, created_at = excluded.created_at`,
    args: [guildId, userId, roleId, createdBy, Date.now()],
  });
}

async function removeLink(guildId, userId, roleId) {
  await db.ready;
  await db.client.execute({
    sql: 'DELETE FROM custom_role_links WHERE guild_id = ? AND user_id = ? AND role_id = ?',
    args: [guildId, userId, roleId],
  });
}

async function getLinksForUser(guildId, userId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM custom_role_links WHERE guild_id = ? AND user_id = ?',
    args: [guildId, userId],
  });
  return result.rows;
}

async function getAllLinksInGuild(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM custom_role_links WHERE guild_id = ? ORDER BY user_id',
    args: [guildId],
  });
  return result.rows;
}

module.exports = {
  isEnabled,
  setEnabled,
  addLink,
  removeLink,
  getLinksForUser,
  getAllLinksInGuild,
};
