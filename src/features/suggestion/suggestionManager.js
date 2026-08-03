const { EmbedBuilder } = require('discord.js');
const { client: db } = require('../../database/db');

const STATUS_STYLE = {
  pending: { color: 0x3b87c2, label: '🕐 Pending' },
  approved: { color: 0x00ff00, label: '✅ Approved' },
  denied: { color: 0xff0000, label: '❌ Denied' },
};

const VOTE_EMOJIS = ['⬆️', '⬇️'];

function buildSuggestionEmbed(suggestion, authorTag, authorAvatarURL, decidedByTag) {
  const style = STATUS_STYLE[suggestion.status] || STATUS_STYLE.pending;

  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setTitle(`💡 Suggestion #${suggestion.number}`)
    .setDescription(suggestion.content)
    .setFooter({ text: `Suggested by ${authorTag}`, iconURL: authorAvatarURL });

  let statusValue = style.label;
  if (suggestion.status !== 'pending' && decidedByTag) {
    statusValue += ` by ${decidedByTag}`;
  }
  embed.addFields({ name: 'Status', value: statusValue });

  return embed;
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

// Re-renders the embed for a suggestion in place (used after edit/approve/deny).
async function refreshEmbed(guild, suggestion) {
  if (!suggestion.message_id) return;

  const channel = guild.channels.cache.get(suggestion.channel_id);
  if (!channel) return;

  const message = await channel.messages.fetch(suggestion.message_id).catch(() => null);
  if (!message) return;

  const author = await guild.client.users.fetch(suggestion.user_id).catch(() => null);
  const decidedByUser = suggestion.decided_by
    ? await guild.client.users.fetch(suggestion.decided_by).catch(() => null)
    : null;

  const embed = buildSuggestionEmbed(
    suggestion,
    author ? author.tag ?? author.username : `<@${suggestion.user_id}>`,
    author ? author.displayAvatarURL() : null,
    decidedByUser ? decidedByUser.tag ?? decidedByUser.username : null
  );

  await message.edit({ embeds: [embed] }).catch(() => null);
}

// Deletes the previous message for a suggestion (if it still exists) and
// posts a brand new one with the current embed — used for approve/deny, so
// the decision shows up as a freshly reposted message with the matching
// color, rather than a silent in-place edit.
async function repostSuggestion(guild, suggestion) {
  const channel = guild.channels.cache.get(suggestion.channel_id);
  if (!channel) return;

  if (suggestion.message_id) {
    const oldMessage = await channel.messages.fetch(suggestion.message_id).catch(() => null);
    if (oldMessage) await oldMessage.delete().catch(() => null);
  }

  const author = await guild.client.users.fetch(suggestion.user_id).catch(() => null);
  const decidedByUser = suggestion.decided_by
    ? await guild.client.users.fetch(suggestion.decided_by).catch(() => null)
    : null;

  const embed = buildSuggestionEmbed(
    suggestion,
    author ? author.tag ?? author.username : `<@${suggestion.user_id}>`,
    author ? author.displayAvatarURL() : null,
    decidedByUser ? decidedByUser.tag ?? decidedByUser.username : null
  );

  const newMessage = await channel.send({ embeds: [embed] });

  await db.execute({
    sql: 'UPDATE suggestions SET message_id = ? WHERE guild_id = ? AND number = ?',
    args: [newMessage.id, suggestion.guild_id, suggestion.number],
  });
  suggestion.message_id = newMessage.id;
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

// Marks a suggestion as approved/denied and reposts it with the matching
// embed color (deletes the old message, posts a new one).
async function setStatus(guild, number, status, decidedById) {
  const suggestion = await getSuggestion(guild.id, number);
  if (!suggestion) return null;

  const decidedAt = Date.now();
  await db.execute({
    sql: 'UPDATE suggestions SET status = ?, decided_by = ?, decided_at = ? WHERE guild_id = ? AND number = ?',
    args: [status, decidedById, decidedAt, guild.id, number],
  });

  suggestion.status = status;
  suggestion.decided_by = decidedById;
  suggestion.decided_at = decidedAt;
  await repostSuggestion(guild, suggestion);
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
