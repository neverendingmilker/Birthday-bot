const suggestionManager = require('../../../features/suggestion/suggestionManager');

async function handleAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channelId = await suggestionManager.getChannelId(interaction.guild.id);
  if (!channelId) {
    await interaction.editReply({
      content: '⚠️ No suggestion channel is configured yet. Ask an admin to run `/suggestion channel set` first.',
    });
    return;
  }

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel) {
    await interaction.editReply({
      content: '⚠️ The configured suggestion channel no longer exists. Ask an admin to set a new one.',
    });
    return;
  }

  const content = interaction.options.getString('text');

  await suggestionManager.createSuggestion(channel, interaction.user, content);

  // No confirmation message: the posted suggestion in the channel is
  // confirmation enough, so the deferred ephemeral reply is just deleted.
  await interaction.deleteReply().catch(() => null);
}

module.exports = { handleAdd };
