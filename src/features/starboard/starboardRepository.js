const db = require('../../database/db');

// --- Feature on/off toggle (per guild, applies to every starboard configured in it) ---

async function isEnabled(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT enabled FROM starboard_config WHERE guild_id = ?',
    args: [guildId],
  });
  const row = result.rows[0];
  return row ? Number(row.enabled) === 1 : true; // enabled by default until explicitly toggled off
}

async function setEnabled(guildId, enabled) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO starboard_config (guild_id, enabled)
          VALUES (?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET enabled = excluded.enabled`,
    args: [guildId, enabled ? 1 : 0],
  });
}

// --- Starboard configs (a guild can have several, each watching its own channel) ---

function mapBoardRow(row) {
  return {
    id: row.id,
    guild_id: row.guild_id,
    name: row.name,
    watch_channel_id: row.watch_channel_id,
    post_channel_id: row.post_channel_id,
    threshold: Number(row.threshold),
    emojis: row.emojis, // stored as a JSON array string, parsed by the manager
    content_type: row.content_type,
    voting_method: row.voting_method,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

async function createStarboard(
  guildId,
  name,
  watchChannelId,
  postChannelId,
  threshold,
  emojisJson,
  contentType,
  votingMethod,
  createdBy
) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO starboards (guild_id, name, watch_channel_id, post_channel_id, threshold, emojis, content_type, voting_method, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [guildId, name, watchChannelId, postChannelId, threshold, emojisJson, contentType, votingMethod, createdBy, Date.now()],
  });
}

// Partial update: only columns present in `fields` are touched.
async function updateStarboard(guildId, name, fields) {
  await db.ready;
  const columns = Object.keys(fields);
  if (columns.length === 0) return 0;

  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const args = [...columns.map((col) => fields[col]), guildId, name];

  const result = await db.client.execute({
    sql: `UPDATE starboards SET ${setClause} WHERE guild_id = ? AND name = ?`,
    args,
  });
  return result.rowsAffected ?? 0;
}

async function removeStarboard(guildId, name) {
  await db.ready;
  const board = await getByName(guildId, name);
  if (!board) return 0;

  // Cascade: drop every tracked starboard post/vote that belonged to this board too,
  // otherwise they'd linger as orphaned rows nothing ever cleans up.
  await db.client.execute({ sql: 'DELETE FROM starboard_posts WHERE starboard_id = ?', args: [board.id] });
  await db.client.execute({ sql: 'DELETE FROM starboard_votes WHERE starboard_id = ?', args: [board.id] });
  await db.client.execute({ sql: 'DELETE FROM starboard_vote_messages WHERE starboard_id = ?', args: [board.id] });
  const result = await db.client.execute({
    sql: 'DELETE FROM starboards WHERE guild_id = ? AND name = ?',
    args: [guildId, name],
  });
  return result.rowsAffected ?? 0;
}

async function getByName(guildId, name) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM starboards WHERE guild_id = ? AND name = ?',
    args: [guildId, name],
  });
  return result.rows[0] ? mapBoardRow(result.rows[0]) : null;
}

async function getById(starboardId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM starboards WHERE id = ?',
    args: [starboardId],
  });
  return result.rows[0] ? mapBoardRow(result.rows[0]) : null;
}

async function getAllInGuild(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM starboards WHERE guild_id = ? ORDER BY name COLLATE NOCASE',
    args: [guildId],
  });
  return result.rows.map(mapBoardRow);
}

// Boards that watch reactions in a given channel (a channel can feed more than one board).
async function getBoardsWatchingChannel(guildId, channelId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM starboards WHERE guild_id = ? AND watch_channel_id = ?',
    args: [guildId, channelId],
  });
  return result.rows.map(mapBoardRow);
}

// --- Starboard posts (one row per original message that made it onto a given board) ---

async function getPost(starboardId, originalMessageId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM starboard_posts WHERE starboard_id = ? AND original_message_id = ?',
    args: [starboardId, originalMessageId],
  });
  return result.rows[0] ?? null;
}

async function upsertPost(guildId, starboardId, originalMessageId, originalChannelId, starboardMessageId, reactionCount) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO starboard_posts (guild_id, starboard_id, original_message_id, original_channel_id, starboard_message_id, reaction_count)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(starboard_id, original_message_id) DO UPDATE SET
            starboard_message_id = excluded.starboard_message_id,
            reaction_count = excluded.reaction_count`,
    args: [guildId, starboardId, originalMessageId, originalChannelId, starboardMessageId, reactionCount],
  });
}

async function updatePostCount(starboardId, originalMessageId, reactionCount) {
  await db.ready;
  await db.client.execute({
    sql: 'UPDATE starboard_posts SET reaction_count = ? WHERE starboard_id = ? AND original_message_id = ?',
    args: [reactionCount, starboardId, originalMessageId],
  });
}

async function deletePost(starboardId, originalMessageId) {
  await db.ready;
  await db.client.execute({
    sql: 'DELETE FROM starboard_posts WHERE starboard_id = ? AND original_message_id = ?',
    args: [starboardId, originalMessageId],
  });
}

// Used when the original message gets deleted: finds every board's post for it at once.
async function getPostsForOriginalMessage(guildId, originalMessageId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM starboard_posts WHERE guild_id = ? AND original_message_id = ?',
    args: [guildId, originalMessageId],
  });
  return result.rows;
}

// --- Vote-button mode: tracks the bot-posted button message for each original message,
// and who has toggled their vote on, so the button can be a per-user toggle. ---

async function createVoteMessage(starboardId, originalMessageId, buttonMessageId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO starboard_vote_messages (starboard_id, original_message_id, button_message_id)
          VALUES (?, ?, ?)
          ON CONFLICT(starboard_id, original_message_id) DO UPDATE SET button_message_id = excluded.button_message_id`,
    args: [starboardId, originalMessageId, buttonMessageId],
  });
}

async function getVoteMessageByButtonMessageId(starboardId, buttonMessageId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM starboard_vote_messages WHERE starboard_id = ? AND button_message_id = ?',
    args: [starboardId, buttonMessageId],
  });
  return result.rows[0] ?? null;
}

async function deleteVoteMessage(starboardId, originalMessageId) {
  await db.ready;
  await db.client.execute({
    sql: 'DELETE FROM starboard_vote_messages WHERE starboard_id = ? AND original_message_id = ?',
    args: [starboardId, originalMessageId],
  });
}

// Used when the original message gets deleted: finds every board's vote-button message
// for it at once (mirrors getPostsForOriginalMessage, but there's no guild_id column
// here, so the caller filters by board afterwards).
async function getVoteMessagesForOriginalMessage(originalMessageId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM starboard_vote_messages WHERE original_message_id = ?',
    args: [originalMessageId],
  });
  return result.rows;
}

async function hasVoted(starboardId, originalMessageId, userId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT 1 FROM starboard_votes WHERE starboard_id = ? AND original_message_id = ? AND user_id = ?',
    args: [starboardId, originalMessageId, userId],
  });
  return result.rows.length > 0;
}

async function addVote(starboardId, originalMessageId, userId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO starboard_votes (starboard_id, original_message_id, user_id)
          VALUES (?, ?, ?)
          ON CONFLICT(starboard_id, original_message_id, user_id) DO NOTHING`,
    args: [starboardId, originalMessageId, userId],
  });
}

async function removeVote(starboardId, originalMessageId, userId) {
  await db.ready;
  await db.client.execute({
    sql: 'DELETE FROM starboard_votes WHERE starboard_id = ? AND original_message_id = ? AND user_id = ?',
    args: [starboardId, originalMessageId, userId],
  });
}

async function countVotes(starboardId, originalMessageId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT COUNT(*) AS c FROM starboard_votes WHERE starboard_id = ? AND original_message_id = ?',
    args: [starboardId, originalMessageId],
  });
  return Number(result.rows[0]?.c ?? 0);
}

module.exports = {
  isEnabled,
  setEnabled,
  createStarboard,
  updateStarboard,
  removeStarboard,
  getByName,
  getById,
  getAllInGuild,
  getBoardsWatchingChannel,
  getPost,
  upsertPost,
  updatePostCount,
  deletePost,
  getPostsForOriginalMessage,
  createVoteMessage,
  getVoteMessageByButtonMessageId,
  deleteVoteMessage,
  getVoteMessagesForOriginalMessage,
  hasVoted,
  addVote,
  removeVote,
  countVotes,
};
