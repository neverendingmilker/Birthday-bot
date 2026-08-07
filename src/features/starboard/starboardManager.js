const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const repo = require('./starboardRepository');

class ValidationError extends Error {}

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 1000;
const MAX_EMOJIS = 10;
const EMBED_COLOR = 0xffd166;

// Optional per-starboard filter on what kind of message qualifies. "media" here means
// image/GIF/video content (attachments or link embeds), regardless of caption text.
const CONTENT_TYPES = {
  any: 'Any message',
  text_only: 'Text only (no image/GIF/video)',
  image: 'Images only',
  gif: 'GIFs only',
  video: 'Videos only',
  media: 'Any media (image, GIF or video)',
  text_and_media: 'Text + media (needs both)',
};
const DEFAULT_CONTENT_TYPE = 'any';

// How people cast their vote on a message: react with an emoji, or click a button the
// bot posts under every new (matching) message in the watch channel.
const VOTING_METHODS = {
  reactions: 'Reactions',
  buttons: 'Buttons',
};
const DEFAULT_VOTING_METHOD = 'reactions';

async function isEnabled(guildId) {
  return repo.isEnabled(guildId);
}

async function setEnabled(guildId, enabled) {
  await repo.setEnabled(guildId, enabled);
}

// --- Emoji parsing ---
// Accepts unicode emojis and Discord custom emoji (<:name:id> / <a:name:id>), separated
// by whitespace and/or commas, e.g. "⭐ 🔥, <:hype:123456789012345678>".
// Stored as-is (the raw tokens the admin typed), so the list/edit commands can show
// them back exactly as entered. Matching against real reactions happens via emojiKey().
function parseEmojis(input) {
  const tokens = input
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new ValidationError('Provide at least one emoji to count (e.g. "⭐" or "⭐ 🔥").');
  }
  if (tokens.length > MAX_EMOJIS) {
    throw new ValidationError(`You can configure at most ${MAX_EMOJIS} emojis per starboard.`);
  }

  const customEmojiPattern = /^<a?:\w{2,32}:\d{17,20}>$/;
  const seen = new Set();
  const deduped = [];

  for (const token of tokens) {
    const isCustom = customEmojiPattern.test(token);
    // Loose check for unicode emojis: reject plain ASCII/alphanumeric text, since that's
    // almost certainly a typo rather than an emoji (real unicode emojis are multi-byte).
    const looksLikeUnicodeEmoji = !isCustom && /[^\x00-\x7F]/.test(token);

    if (!isCustom && !looksLikeUnicodeEmoji) {
      throw new ValidationError(
        `"${token}" doesn't look like a valid emoji. Use a unicode emoji (⭐) or a custom server emoji (right-click it → "Copy Emoji" if using a client that supports it, or type it directly and Discord will convert it).`
      );
    }

    const key = emojiKeyFromToken(token);
    if (seen.has(key)) continue; // silently dedupe repeats
    seen.add(key);
    deduped.push(token);
  }

  return deduped;
}

function emojiKeyFromToken(token) {
  const customMatch = token.match(/^<a?:\w{2,32}:(\d{17,20})>$/);
  return customMatch ? customMatch[1] : token;
}

function emojiKeyFromReactionEmoji(emoji) {
  return emoji.id ?? emoji.name;
}

function formatEmojisForDisplay(tokens) {
  return tokens.join(' ');
}

// --- Content-type classification ---
// Looks at attachments (uploaded files) and embeds (link previews, e.g. a pasted
// Tenor/YouTube link) to figure out what kind of content a message carries.
function classifyMessage(message) {
  const hasText = !!(message.content && message.content.trim().length > 0);

  const attachments = [...message.attachments.values()];
  const isGifAttachment = (a) => a.contentType === 'image/gif' || /\.gif$/i.test(a.name || '');
  const hasGifAttachment = attachments.some(isGifAttachment);
  const hasImageAttachment = attachments.some((a) => a.contentType?.startsWith('image/') && !isGifAttachment(a));
  const hasVideoAttachment = attachments.some((a) => a.contentType?.startsWith('video/'));

  const embeds = message.embeds || [];
  const isGifEmbedUrl = (url) => !!url && (/\.gif(\?|$)/i.test(url) || /tenor\.com|giphy\.com/i.test(url));
  const hasGifEmbed = embeds.some((e) => isGifEmbedUrl(e.image?.url) || isGifEmbedUrl(e.url));
  const hasVideoEmbed = embeds.some((e) => !!e.video);
  const hasImageEmbed = embeds.some((e) => !!e.image && !isGifEmbedUrl(e.image.url));

  return {
    hasText,
    hasImage: hasImageAttachment || hasImageEmbed,
    hasGif: hasGifAttachment || hasGifEmbed,
    hasVideo: hasVideoAttachment || hasVideoEmbed,
    get hasMedia() {
      return this.hasImage || this.hasGif || this.hasVideo;
    },
  };
}

function matchesContentType(message, contentType) {
  const c = classifyMessage(message);
  switch (contentType) {
    case 'text_only':
      return c.hasText && !c.hasMedia;
    case 'image':
      return c.hasImage;
    case 'gif':
      return c.hasGif;
    case 'video':
      return c.hasVideo;
    case 'media':
      return c.hasMedia;
    case 'text_and_media':
      return c.hasText && c.hasMedia;
    case 'any':
    default:
      return true;
  }
}

// --- Validation helpers ---

function assertValidThreshold(threshold) {
  if (!Number.isInteger(threshold) || threshold < MIN_THRESHOLD || threshold > MAX_THRESHOLD) {
    throw new ValidationError(`Threshold must be a whole number between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}.`);
  }
}

function assertValidContentType(contentType) {
  if (!Object.prototype.hasOwnProperty.call(CONTENT_TYPES, contentType)) {
    throw new ValidationError(`Unknown content type "${contentType}".`);
  }
}

function assertValidVotingMethod(votingMethod) {
  if (!Object.prototype.hasOwnProperty.call(VOTING_METHODS, votingMethod)) {
    throw new ValidationError(`Unknown voting method "${votingMethod}".`);
  }
}

function assertCanPostInChannel(guild, channel) {
  const botMember = guild.members.me;
  const perms = channel.permissionsFor(botMember);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    throw new ValidationError(
      `I need "View Channel" and "Send Messages" permissions in ${channel} to post starboard messages there.`
    );
  }
}

function assertCanReadChannel(guild, channel) {
  const botMember = guild.members.me;
  const perms = channel.permissionsFor(botMember);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])) {
    throw new ValidationError(`I need "View Channel" and "Read Message History" permissions in ${channel} to watch reactions there.`);
  }
}

// --- CRUD used by the /starboard command handlers ---

async function create(guild, name, watchChannel, postChannel, threshold, emojisInput, contentType, votingMethod, createdBy) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new ValidationError('Give this starboard a name.');
  }
  if (watchChannel.id === postChannel.id) {
    throw new ValidationError("The watch channel and the post channel can't be the same channel.");
  }

  assertValidThreshold(threshold);
  const resolvedContentType = contentType ?? DEFAULT_CONTENT_TYPE;
  assertValidContentType(resolvedContentType);
  const resolvedVotingMethod = votingMethod ?? DEFAULT_VOTING_METHOD;
  assertValidVotingMethod(resolvedVotingMethod);
  const emojis = parseEmojis(emojisInput);
  if (resolvedVotingMethod === 'buttons' && emojis.length > 1) {
    throw new ValidationError('Button voting only uses one emoji (shown on the button) — give just one.');
  }
  assertCanReadChannel(guild, watchChannel);
  assertCanPostInChannel(guild, postChannel);

  const existing = await repo.getByName(guild.id, trimmedName);
  if (existing) {
    throw new ValidationError(`A starboard named "${trimmedName}" already exists in this server. Use \`/starboard edit\` to change it.`);
  }

  await repo.createStarboard(
    guild.id,
    trimmedName,
    watchChannel.id,
    postChannel.id,
    threshold,
    JSON.stringify(emojis),
    resolvedContentType,
    resolvedVotingMethod,
    createdBy
  );

  return { name: trimmedName, emojis, contentType: resolvedContentType, votingMethod: resolvedVotingMethod };
}

async function edit(guild, name, updates) {
  const board = await repo.getByName(guild.id, name);
  if (!board) {
    throw new ValidationError(`No starboard named "${name}" found in this server.`);
  }

  const fields = {};

  if (updates.watchChannel) {
    assertCanReadChannel(guild, updates.watchChannel);
    fields.watch_channel_id = updates.watchChannel.id;
  }
  if (updates.postChannel) {
    assertCanPostInChannel(guild, updates.postChannel);
    fields.post_channel_id = updates.postChannel.id;
  }
  const finalWatchId = fields.watch_channel_id ?? board.watch_channel_id;
  const finalPostId = fields.post_channel_id ?? board.post_channel_id;
  if (finalWatchId === finalPostId) {
    throw new ValidationError("The watch channel and the post channel can't be the same channel.");
  }

  if (updates.threshold !== undefined) {
    assertValidThreshold(updates.threshold);
    fields.threshold = updates.threshold;
  }
  if (updates.contentType !== undefined) {
    assertValidContentType(updates.contentType);
    fields.content_type = updates.contentType;
  }
  if (updates.votingMethod !== undefined) {
    assertValidVotingMethod(updates.votingMethod);
    fields.voting_method = updates.votingMethod;
  }
  let emojis;
  if (updates.emojisInput) {
    emojis = parseEmojis(updates.emojisInput);
    fields.emojis = JSON.stringify(emojis);
  }

  const finalVotingMethod = fields.voting_method ?? board.voting_method;
  const finalEmojis = emojis ?? JSON.parse(board.emojis);
  if (finalVotingMethod === 'buttons' && finalEmojis.length > 1) {
    throw new ValidationError('Button voting only uses one emoji (shown on the button) — give just one.');
  }

  if (Object.keys(fields).length === 0) {
    throw new ValidationError('Provide at least one field to change.');
  }

  await repo.updateStarboard(guild.id, name, fields);
  return { ...board, ...fields, emojis: finalEmojis };
}

async function remove(guildId, name) {
  return repo.removeStarboard(guildId, name);
}

async function listAll(guildId) {
  return repo.getAllInGuild(guildId);
}

async function getNamesList(guildId) {
  const boards = await repo.getAllInGuild(guildId);
  return boards.map((b) => b.name);
}

// --- Embed / message formatting ---

function buildStarboardEmbed(message, count) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setAuthor({
      name: message.author?.tag ?? 'Unknown user',
      iconURL: message.author?.displayAvatarURL?.() ?? undefined,
    })
    .setDescription(message.content ? message.content.slice(0, 4000) : null)
    .addFields({ name: 'Original message', value: `[Jump to message](${message.url})` })
    .setFooter({ text: `#${message.channel?.name ?? 'unknown-channel'}` })
    .setTimestamp(message.createdAt);

  const imageAttachment = message.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (imageAttachment) embed.setImage(imageAttachment.url);
  else {
    const embedImage = message.embeds.find((e) => e.image || e.thumbnail);
    if (embedImage) embed.setImage(embedImage.image?.url ?? embedImage.thumbnail?.url);
  }

  return embed;
}

// Top line shown above the embed: just the star count, so it visibly ticks up/down live
// as reactions are added or removed, without repeating info already in the embed footer.
function formatStarLine(board, count) {
  const emojiTokens = JSON.parse(board.emojis);
  return `${emojiTokens[0]} **${count}**`;
}

// Recomputes the count for one board on one message and creates/updates/removes the
// corresponding starboard post accordingly. Falling back below the threshold removes
// the post — a starboard reflects what's currently popular, not what once was.
async function syncStarboardPost(guild, board, message, count) {
  const post = await repo.getPost(board.id, message.id);

  if (count < board.threshold) {
    if (post) {
      const postChannel = await guild.channels.fetch(board.post_channel_id).catch(() => null);
      const starMessage = postChannel ? await postChannel.messages.fetch(post.starboard_message_id).catch(() => null) : null;
      if (starMessage) await starMessage.delete().catch(() => {});
      await repo.deletePost(board.id, message.id);
    }
    return;
  }

  if (post) {
    const postChannel = await guild.channels.fetch(board.post_channel_id).catch(() => null);
    const starMessage = postChannel ? await postChannel.messages.fetch(post.starboard_message_id).catch(() => null) : null;

    if (starMessage) {
      await starMessage
        .edit({ content: formatStarLine(board, count), embeds: [buildStarboardEmbed(message, count)] })
        .catch(() => {});
      await repo.updatePostCount(board.id, message.id, count);
      return;
    }

    // The starboard message was deleted by hand (or the channel is gone): forget the
    // record so it's free to be recreated below, since the message still qualifies.
    await repo.deletePost(board.id, message.id);
  }

  const postChannel = await guild.channels.fetch(board.post_channel_id).catch(() => null);
  if (!postChannel || !postChannel.isTextBased()) return;

  try {
    const sent = await postChannel.send({
      content: formatStarLine(board, count),
      embeds: [buildStarboardEmbed(message, count)],
    });
    await repo.upsertPost(guild.id, board.id, message.id, message.channelId, sent.id, count);
  } catch (err) {
    console.warn(`[starboard] Could not post to the starboard channel for board "${board.name}" in guild ${guild.id}:`, err.message);
  }
}

// Counts distinct (non-bot, non-author) users who reacted with any of the board's
// configured emojis, then syncs the starboard post for that board/message pair.
// Messages that don't match the board's content-type filter are treated as a 0 count
// (which — via syncStarboardPost — also cleans up a stale post if the filter changed).
async function countAndSync(guild, board, message) {
  if (!matchesContentType(message, board.content_type)) {
    await syncStarboardPost(guild, board, message, 0);
    return;
  }

  const emojiKeys = JSON.parse(board.emojis).map(emojiKeyFromToken);
  const matchingReactions = [...message.reactions.cache.values()].filter((r) =>
    emojiKeys.includes(emojiKeyFromReactionEmoji(r.emoji))
  );

  const userIds = new Set();
  for (const reaction of matchingReactions) {
    const users = await reaction.users.fetch().catch(() => null);
    if (!users) continue;
    for (const user of users.values()) {
      if (user.bot) continue;
      if (message.author && user.id === message.author.id) continue; // no self-starring
      userIds.add(user.id);
    }
  }

  await syncStarboardPost(guild, board, message, userIds.size);
}

// Called on every messageReactionAdd/Remove for a message in a channel that at least
// one starboard is watching. Re-syncs every matching board for that message.
async function handleReactionChange(reaction, guild) {
  if (!(await repo.isEnabled(guild.id))) return;

  const boards = (await repo.getBoardsWatchingChannel(guild.id, reaction.message.channelId)).filter(
    (b) => b.voting_method === 'reactions'
  );
  if (boards.length === 0) return;

  let message;
  try {
    message = await reaction.message.fetch();
  } catch {
    return; // message (or channel) no longer exists
  }

  for (const board of boards) {
    await countAndSync(guild, board, message).catch((err) =>
      console.error(`[starboard] Error syncing board "${board.name}" for message ${message.id}:`, err)
    );
  }
}

// Called on messageDelete: removes every starboard post that pointed at the deleted
// original message, across every board, so a starred-then-deleted message doesn't stay
// visible on the starboard forever. Also cleans up any vote-button message and vote
// records tied to it.
async function handleMessageDelete(message) {
  if (!message.guildId) return;

  const posts = await repo.getPostsForOriginalMessage(message.guildId, message.id);
  for (const post of posts) {
    const board = await repo.getById(post.starboard_id);
    if (board) {
      const postChannel = await message.client.channels.fetch(board.post_channel_id).catch(() => null);
      const starMessage = postChannel ? await postChannel.messages.fetch(post.starboard_message_id).catch(() => null) : null;
      if (starMessage) await starMessage.delete().catch(() => {});
    }
    await repo.deletePost(post.starboard_id, post.original_message_id);
  }

  const voteMessages = await repo.getVoteMessagesForOriginalMessage(message.id);
  for (const voteMessage of voteMessages) {
    const board = await repo.getById(voteMessage.starboard_id);
    if (board) {
      const watchChannel = await message.client.channels.fetch(board.watch_channel_id).catch(() => null);
      const buttonMessage = watchChannel
        ? await watchChannel.messages.fetch(voteMessage.button_message_id).catch(() => null)
        : null;
      if (buttonMessage) await buttonMessage.delete().catch(() => {});
    }
    await repo.deleteVoteMessage(voteMessage.starboard_id, voteMessage.original_message_id);
  }
}

// --- Button-vote mode ---
// One button per (matching) new message in the watch channel, posted by the bot as a
// reply. Clicking toggles that user's vote; the label shows the live count.

function buildVoteButtonRow(board, count) {
  const [emoji] = JSON.parse(board.emojis);
  const button = new ButtonBuilder()
    .setCustomId(`starboard:vote:${board.id}`)
    .setLabel(String(count))
    .setStyle(count >= board.threshold ? ButtonStyle.Success : ButtonStyle.Secondary);

  const customEmojiMatch = emoji.match(/^<a?:(\w{2,32}):(\d{17,20})>$/);
  if (customEmojiMatch) {
    button.setEmoji({ name: customEmojiMatch[1], id: customEmojiMatch[2], animated: emoji.startsWith('<a:') });
  } else {
    button.setEmoji(emoji);
  }

  return new ActionRowBuilder().addComponents(button);
}

// Called from messageCreate for every new message in a channel watched by at least one
// buttons-mode board. Posts one vote button per matching board, as a reply so it's
// visually tied to the original message.
async function handleNewMessage(message) {
  if (!message.guild || message.author?.bot) return;
  if (!(await repo.isEnabled(message.guild.id))) return;

  const boards = (await repo.getBoardsWatchingChannel(message.guild.id, message.channelId)).filter(
    (b) => b.voting_method === 'buttons'
  );

  for (const board of boards) {
    if (!matchesContentType(message, board.content_type)) continue;

    try {
      const row = buildVoteButtonRow(board, 0);
      const sent = await message.reply({ components: [row], allowedMentions: { repliedUser: false } });
      await repo.createVoteMessage(board.id, message.id, sent.id);
    } catch (err) {
      console.warn(`[starboard] Could not post the vote button for board "${board.name}" in guild ${message.guild.id}:`, err.message);
    }
  }
}

// Called from interactionCreate for clicks on a "starboard:vote:<boardId>" button.
async function handleVoteButtonClick(interaction) {
  const boardId = Number(interaction.customId.split(':')[2]);
  const board = await repo.getById(boardId);

  if (!board || board.guild_id !== interaction.guildId || board.voting_method !== 'buttons') {
    await interaction.reply({ content: '⚠️ This starboard no longer exists.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!(await repo.isEnabled(interaction.guildId))) {
    await interaction.reply({
      content: '⚠️ The Starboard feature is currently disabled in this server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const voteMessage = await repo.getVoteMessageByButtonMessageId(board.id, interaction.message.id);
  if (!voteMessage) {
    await interaction.reply({ content: '⚠️ Could not find the original message for this vote.', flags: MessageFlags.Ephemeral });
    return;
  }

  const watchChannel = await interaction.guild.channels.fetch(board.watch_channel_id).catch(() => null);
  const originalMessage = watchChannel
    ? await watchChannel.messages.fetch(voteMessage.original_message_id).catch(() => null)
    : null;
  if (!originalMessage) {
    await interaction.reply({ content: '⚠️ The original message no longer exists.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (originalMessage.author?.id === interaction.user.id) {
    await interaction.reply({ content: "You can't vote for your own message.", flags: MessageFlags.Ephemeral });
    return;
  }

  const alreadyVoted = await repo.hasVoted(board.id, voteMessage.original_message_id, interaction.user.id);
  if (alreadyVoted) {
    await repo.removeVote(board.id, voteMessage.original_message_id, interaction.user.id);
  } else {
    await repo.addVote(board.id, voteMessage.original_message_id, interaction.user.id);
  }

  const count = await repo.countVotes(board.id, voteMessage.original_message_id);
  const row = buildVoteButtonRow(board, count);

  await interaction.update({ components: [row] });
  await syncStarboardPost(interaction.guild, board, originalMessage, count);
}

module.exports = {
  ValidationError,
  CONTENT_TYPES,
  DEFAULT_CONTENT_TYPE,
  VOTING_METHODS,
  DEFAULT_VOTING_METHOD,
  isEnabled,
  setEnabled,
  create,
  edit,
  remove,
  listAll,
  getNamesList,
  formatEmojisForDisplay,
  handleReactionChange,
  handleMessageDelete,
  handleNewMessage,
  handleVoteButtonClick,
};
