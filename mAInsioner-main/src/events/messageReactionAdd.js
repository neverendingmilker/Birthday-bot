const { PermissionFlagsBits } = require('discord.js');
const suggestionManager = require('../features/suggestion/suggestionManager');

module.exports = {
  name: 'messageReactionAdd',
  once: false,
  async execute(reaction, user) {
    if (user.bot) return; // ignore the bot's own vote reactions added at creation

    // Only check00/wrong00 act as the decide-by-react shortcut; anything
    // else (including regular emoji people might react with) is ignored.
    const emojiId = reaction.emoji.id;
    let status;
    if (emojiId === suggestionManager.UPVOTE_EMOJI.id) status = 'approved';
    else if (emojiId === suggestionManager.DOWNVOTE_EMOJI.id) status = 'denied';
    else return;

    // Reactions on messages the bot doesn't have cached (e.g. posted before
    // a restart) arrive as partials — fetch the full data before using it.
    if (reaction.partial) {
      reaction = await reaction.fetch().catch(() => null);
      if (!reaction) return;
    }
    if (reaction.message.partial) {
      await reaction.message.fetch().catch(() => null);
    }

    const message = reaction.message;
    if (!message.guild) return;

    const suggestion = await suggestionManager.getSuggestionByMessageId(message.id);
    if (!suggestion) return; // not a suggestion message

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) return; // non-admins just vote

    if (suggestion.status === status) return; // already in that state, avoid a duplicate repost

    await suggestionManager.setStatus(message.guild, suggestion.number, status, user.id).catch((err) => {
      console.error(`[suggestion] Failed to decide suggestion #${suggestion.number} via reaction:`, err);
    });
  },
};
