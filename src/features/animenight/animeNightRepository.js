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
    sql: 'SELECT * FROM anime_night_entries WHERE guild_id = ? ORDER BY id ASC',
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

// All entries for a single session (= all anime sharing the same watched_date)
async function getEntriesForDate(guildId, watchedDate) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM anime_night_entries WHERE guild_id = ? AND watched_date = ?',
    args: [guildId, watchedDate],
  });
  return result.rows;
}

// Replaces the entire title list of a session, optionally moving it to a new date
// in the same operation (delete + reinsert, in a single batch).
async function replaceSession(guildId, oldDate, newDate, titles, editedBy) {
  await db.ready;
  const addedAt = Date.now();

  const statements = [
    { sql: 'DELETE FROM anime_night_entries WHERE guild_id = ? AND watched_date = ?', args: [guildId, oldDate] },
    ...titles.map((title) => ({
      sql: `INSERT INTO anime_night_entries (guild_id, title, watched_date, added_at, added_by)
            VALUES (?, ?, ?, ?, ?)`,
      args: [guildId, title, newDate, addedAt, editedBy],
    })),
  ];

  await db.client.batch(statements, 'write');
}

// Moves a session to a new date without touching its titles. If the new date
// matches an existing session, they naturally merge (grouping is purely by date).
async function updateSessionDate(guildId, oldDate, newDate) {
  await db.ready;
  await db.client.execute({
    sql: 'UPDATE anime_night_entries SET watched_date = ? WHERE guild_id = ? AND watched_date = ?',
    args: [newDate, guildId, oldDate],
  });
}

module.exports = {
  addEntries,
  getAllEntries,
  getLastEntries,
  getEntriesForDate,
  replaceSession,
  updateSessionDate,
};
