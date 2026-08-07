const { PermissionFlagsBits } = require('discord.js');
const starboardManager = require('../../../features/starboard/starboardManager');

async function handleEdit(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: '❌ You need the "Manage Server" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const name = interaction.options.getString('name');
  const watchChannel = interaction.options.getChannel('watch_channel') ?? undefined;
  const postChannel = interaction.options.getChannel('post_channel') ?? undefined;
  const threshold = interaction.options.getInteger('threshold') ?? undefined;
  const emojisInput = interaction.options.getString('emojis') ?? undefined;
  const contentType = interaction.options.getString('content_type') ?? undefined;
  const votingMethod = interaction.options.getString('voting_method') ?? undefined;

  let updated;
  try {
    updated = await starboardManager.edit(interaction.guild, name, {
      watchChannel,
      postChannel,
      threshold,
      emojisInput,
      contentType,
      votingMethod,
    });
  } catch (err) {
    if (err instanceof starboardManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }

  await interaction.reply({
    content:
      `✅ Starboard **${name}** updated: watching <#${updated.watch_channel_id}>, ` +
      `posting to <#${updated.post_channel_id}>, threshold **${updated.threshold}**, ` +
      `emojis ${starboardManager.formatEmojisForDisplay(updated.emojis)}, ` +
      `content filter **${starboardManager.CONTENT_TYPES[updated.content_type]}**, ` +
      `voting **${starboardManager.VOTING_METHODS[updated.voting_method]}**.`,
    ephemeral: true,
  });
}

module.exports = { handleEdit };
