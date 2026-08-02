const db = require('../../database/db');

async function addPoints(guildId, userId, username, points) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO quiz_scores (guild_id, user_id, username, points)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(guild_id, user_id) DO UPDATE SET
            username = excluded.username,
            points = points + excluded.points`,
    args: [guildId, userId, username, points],
  });
}

async function leaderboard(guildId, top = 10) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT username, points FROM quiz_scores WHERE guild_id = ? ORDER BY points DESC LIMIT ?',
    args: [guildId, top],
  });
  return result.rows.map((row) => ({ username: row.username, points: Number(row.points) }));
}

async function reset(guildId) {
  await db.ready;
  await db.client.execute({
    sql: 'DELETE FROM quiz_scores WHERE guild_id = ?',
    args: [guildId],
  });
}

module.exports = { addPoints, leaderboard, reset };
