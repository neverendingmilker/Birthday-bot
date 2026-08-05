const db = require('../../database/db');

// --- Feature on/off toggle (per guild) ---

async function isEnabled(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT enabled FROM role_link_config WHERE guild_id = ?',
    args: [guildId],
  });
  const row = result.rows[0];
  return row ? Number(row.enabled) === 1 : true; // enabled by default until explicitly toggled off
}

async function setEnabled(guildId, enabled) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO role_link_config (guild_id, enabled)
          VALUES (?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET enabled = excluded.enabled`,
    args: [guildId, enabled ? 1 : 0],
  });
}

// --- role1 <-> role2 links ---

// Adds/updates a role1 -> role2 link. `bidirectional` also removes role1 when
// role2 is lost, not just the other way around.
async function addLink(guildId, roleAId, roleBId, bidirectional, createdBy) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO role_links (guild_id, role_a_id, role_b_id, bidirectional, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(guild_id, role_a_id, role_b_id) DO UPDATE SET
            bidirectional = excluded.bidirectional,
            created_by = excluded.created_by,
            created_at = excluded.created_at`,
    args: [guildId, roleAId, roleBId, bidirectional ? 1 : 0, createdBy, Date.now()],
  });
}

async function removeLink(guildId, roleAId, roleBId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'DELETE FROM role_links WHERE guild_id = ? AND role_a_id = ? AND role_b_id = ?',
    args: [guildId, roleAId, roleBId],
  });
  return result.rowsAffected ?? 0;
}

async function getAllLinksInGuild(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM role_links WHERE guild_id = ?',
    args: [guildId],
  });
  return result.rows.map((row) => ({
    guild_id: row.guild_id,
    role_a_id: row.role_a_id,
    role_b_id: row.role_b_id,
    bidirectional: Number(row.bidirectional) === 1,
    created_by: row.created_by,
    created_at: row.created_at,
  }));
}

module.exports = { addLink, removeLink, getAllLinksInGuild, isEnabled, setEnabled };
