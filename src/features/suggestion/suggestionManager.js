const { EmbedBuilder } = require('discord.js');
const { client: db } = require('../../database/db');

const STATUS_COLORS = {
  pending: 0x3b87c2,
  approved: 0x00ff00,
  denied: 0xff0000,
};

const VOTE_EMOJIS = ['⬆️', '⬇️'];

function buildSuggestionEmbed(suggestion, authorTag, authorAvatarURL) {
  const color = STATUS_COLORS[suggestion.status] || STATUS_COLORS.pending;
  const titleSuffix = suggestion.status === 'approved' ? ' ✅' : suggestion.status === 'denied' ? ' ❌' : '';

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: authorTag, iconURL: authorAvatarURL })
    .setTitle(`Suggestion #${suggestion.number}${titleSuffix}`)
    .setDescription(suggestion.content);
}

// Adds the up/down vote reactions in order. Sequential on purpose: reacting
// in parallel doesn't guarantee they show up left-to-right in the client.
async function addVoteReactions(message) {
  for (const emoji of VOTE_EMOJIS) {
    await message.react(emoji).catch(() => null);
  }
}

// --- Channel configuration ---

async function getChannelId(guildId) {
  const result = await db.execute({
    sql: 'SELECT channel_id FROM suggestion_config WHERE guild_id = ?',
    args: [guildId],
  });
  return result.rows[0]?.channel_id || null;
}

async function setChannel(guildId, channelId) {
  await db.execute({
    sql: `INSERT INTO suggestion_config (guild_id, channel_id) VALUES (?, ?)
          ON CONFLICT (guild_id) DO UPDATE SET channel_id = excluded.channel_id`,
    args: [guildId, channelId],
  });
}

async function removeChannel(guildId) {
  await db.execute({
    sql: 'UPDATE suggestion_config SET channel_id = NULL WHERE guild_id = ?',
    args: [guildId],
  });
}

// --- Suggestions ---

async function getSuggestion(guildId, number) {
  const result = await db.execute({
    sql: 'SELECT * FROM suggestions WHERE guild_id = ? AND number = ?',
    args: [guildId, number],
  });
  return result.rows[0] || null;
}

// Creates a new suggestion, posts its embed in the configured channel, and
// stores the resulting message id so it can be edited later (on /edit,
// /approve, /deny).
async function createSuggestion(channel, author, content) {
  const guildId = channel.guild.id;

  const numberResult = await db.execute({
    sql: 'SELECT COALESCE(MAX(number), 0) + 1 AS next_number FROM suggestions WHERE guild_id = ?',
    args: [guildId],
  });
  const number = numberResult.rows[0].next_number;

  const suggestion = {
    number,
    content,
    status: 'pending',
  };

  const message = await channel.send({
    embeds: [buildSuggestionEmbed(suggestion, author.tag ?? author.username, author.displayAvatarURL())],
  });

  await addVoteReactions(message);

  await db.execute({
    sql: `INSERT INTO suggestions (guild_id, number, user_id, content, status, channel_id, message_id, created_at)
          VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    args: [guildId, number, author.id, content, channel.id, message.id, Date.now()],
  });

  return number;
}

// Re-renders the embed for a suggestion in place (used after /edit only —
// approve/deny use repostSuggestion below instead).
async function refreshEmbed(guild, suggestion) {
  if (!suggestion.message_id) return;

  const channel = guild.channels.cache.get(suggestion.channel_id);
  if (!channel) return;

  const message = await channel.messages.fetch(suggestion.message_id).catch(() => null);
  if (!message) return;

  const author = await guild.client.users.fetch(suggestion.user_id).catch(() => null);

  const embed = buildSuggestionEmbed(
    suggestion,
    author ? author.tag ?? author.username : `<@${suggestion.user_id}>`,
    author ? author.displayAvatarURL() : null
  );

  await message.edit({ embeds: [embed] }).catch(() => null);
}

// Deletes the original suggestion message (if it still exists) and posts a
// brand new one with the updated embed (color + ✅/❌ next to the number in
// the title) — used for approve/deny, which repost rather than edit in place.
async function repostSuggestion(guild, suggestion) {
  const channel = guild.channels.cache.get(suggestion.channel_id);
  if (!channel) return;

  if (suggestion.message_id) {
    const oldMessage = await channel.messages.fetch(suggestion.message_id).catch(() => null);
    if (oldMessage) await oldMessage.delete().catch(() => null);
  }

  const author = await guild.client.users.fetch(suggestion.user_id).catch(() => null);

  const embed = buildSuggestionEmbed(
    suggestion,
    author ? author.tag ?? author.username : `<@${suggestion.user_id}>`,
    author ? author.displayAvatarURL() : null
  );

  await channel.send({ embeds: [embed] });
}

// Updates the text of a suggestion (only allowed, at the command level, for
// its own author while it's still pending) and refreshes the posted embed.
async function editContent(guild, number, newContent) {
  const suggestion = await getSuggestion(guild.id, number);
  if (!suggestion) return null;

  await db.execute({
    sql: 'UPDATE suggestions SET content = ? WHERE guild_id = ? AND number = ?',
    args: [newContent, guild.id, number],
  });

  suggestion.content = newContent;
  await refreshEmbed(guild, suggestion);
  return suggestion;
}

// Marks a suggestion as approved/denied, reposts it (delete + resend) with
// the updated color and the ✅/❌ next to the number in the title, then
// removes the row from the database — decided suggestions aren't kept around.
async function setStatus(guild, number, status, decidedById) {
  const suggestion = await getSuggestion(guild.id, number);
  if (!suggestion) return null;

  suggestion.status = status;
  suggestion.decided_by = decidedById;
  suggestion.decided_at = Date.now();

  await repostSuggestion(guild, suggestion);

  await db.execute({
    sql: 'DELETE FROM suggestions WHERE guild_id = ? AND number = ?',
    args: [guild.id, number],
  });

  return suggestion;
}

async function listPending(guildId) {
  const result = await db.execute({
    sql: "SELECT * FROM suggestions WHERE guild_id = ? AND status = 'pending' ORDER BY number ASC",
    args: [guildId],
  });
  return result.rows;
}

module.exports = {
  getChannelId,
  setChannel,
  removeChannel,
  getSuggestion,
  createSuggestion,
  editContent,
  setStatus,
  listPending,
};
