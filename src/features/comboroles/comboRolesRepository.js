const db = require('../../database/db');

async function isEnabled(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT enabled FROM comboroles_config WHERE guild_id = ?',
    args: [guildId],
  });
  const row = result.rows[0];
  return row ? Boolean(row.enabled) : true; // enabled by default until explicitly toggled off
}

async function setEnabled(guildId, enabled) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO comboroles_config (guild_id, enabled) VALUES (?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET enabled = excluded.enabled`,
    args: [guildId, enabled ? 1 : 0],
  });
}

module.exports = { isEnabled, setEnabled };
