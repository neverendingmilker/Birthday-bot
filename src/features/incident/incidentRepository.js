const db = require('../../database/db');

// --- Guild config (posting channel + current count + last posted message) ---

async function getGuildConfig(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM incident_config WHERE guild_id = ?',
    args: [guildId],
  });

  const row = result.rows[0];
  return row
    ? {
        guild_id: row.guild_id,
        channel_id: row.channel_id,
        count: Number(row.count ?? 0),
        last_message_id: row.last_message_id,
      }
    : { guild_id: guildId, channel_id: null, count: 0, last_message_id: null };
}

async function setChannel(guildId, channelId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO incident_config (guild_id, channel_id, count, last_message_id)
          VALUES (?, ?, 0, NULL)
          ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id`,
    args: [guildId, channelId],
  });
}

async function setCount(guildId, count) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO incident_config (guild_id, channel_id, count, last_message_id)
          VALUES (?, NULL, ?, NULL)
          ON CONFLICT(guild_id) DO UPDATE SET count = excluded.count`,
    args: [guildId, count],
  });
}

async function setLastMessageId(guildId, messageId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO incident_config (guild_id, channel_id, count, last_message_id)
          VALUES (?, NULL, 0, ?)
          ON CONFLICT(guild_id) DO UPDATE SET last_message_id = excluded.last_message_id`,
    args: [guildId, messageId],
  });
}

async function isEnabled(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT enabled FROM incident_config WHERE guild_id = ?',
    args: [guildId],
  });
  const row = result.rows[0];
  return row ? Boolean(row.enabled) : true; // enabled by default until explicitly toggled off
}

async function setEnabled(guildId, enabled) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO incident_config (guild_id, count, enabled)
          VALUES (?, 0, ?)
          ON CONFLICT(guild_id) DO UPDATE SET enabled = excluded.enabled`,
    args: [guildId, enabled ? 1 : 0],
  });
}

// Every guild that has a posting channel configured (used by the daily scheduler
// to know which guilds' counters need to be incremented).
async function getAllConfiguredGuilds() {
  await db.ready;
  const result = await db.client.execute('SELECT * FROM incident_config WHERE channel_id IS NOT NULL');
  return result.rows;
}

module.exports = {
  getGuildConfig,
  setChannel,
  setCount,
  setLastMessageId,
  isEnabled,
  setEnabled,
  getAllConfiguredGuilds,
};
