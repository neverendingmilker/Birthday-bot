const db = require('../../database/db');

// Inserts multiple anime entries in a single batch (all sharing the same watched
// date and "added at" timestamp, since they come from one /animenight add call).
async function addEntries(guildId, titles, watchedDate, addedBy) {
  await db.ready;
  const addedAt = Date.now();

  const statements = titles.map((title) => ({
    sql: `INSERT INTO anime_night_entries (guild_id, title, watched_date, added_at, added_by)
          VALUES (?, ?, ?, ?, ?)`,
    args: [guildId, title, watchedDate, addedAt, addedBy],
  }));

  await db.client.batch(statements, 'write');
}

async function getAllEntries(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM anime_night_entries WHERE guild_id = ?',
    args: [guildId],
  });
  return result.rows;
}

async function getLastEntries(guildId, limit) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM anime_night_entries WHERE guild_id = ? ORDER BY added_at DESC, id DESC LIMIT ?',
    args: [guildId, limit],
  });
  return result.rows;
}

module.exports = { addEntries, getAllEntries, getLastEntries };
