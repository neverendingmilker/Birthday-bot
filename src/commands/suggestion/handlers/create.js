const suggestionManager = require('../../../features/suggestion/suggestionManager');

async function handleCreate(interaction) {
  const channelId = await suggestionManager.getChannelId(interaction.guild.id);
  if (!channelId) {
    await interaction.reply({
      content: '⚠️ No suggestion channel is configured yet. Ask an admin to run `/suggestion channel set` first.',
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel) {
    await interaction.reply({
      content: '⚠️ The configured suggestion channel no longer exists. Ask an admin to set a new one.',
      ephemeral: true,
    });
    return;
  }

  const content = interaction.options.getString('text');

  const number = await suggestionManager.createSuggestion(channel, interaction.user, content);

  await interaction.reply({
    content: `✅ Your suggestion has been posted in ${channel} as **#${number}**.`,
    ephemeral: true,
  });
}

module.exports = { handleCreate };
