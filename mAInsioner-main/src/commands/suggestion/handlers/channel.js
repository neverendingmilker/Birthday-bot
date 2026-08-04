const { PermissionFlagsBits } = require('discord.js');
const suggestionManager = require('../../../features/suggestion/suggestionManager');

async function handleChannelSet(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '⚠️ You need admin permissions to configure the suggestion channel.',
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.options.getChannel('channel');

  const botMember = interaction.guild.members.me;
  const canPost =
    botMember &&
    channel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
  if (!canPost) {
    await interaction.reply({
      content: `⚠️ I don't have permission to view/send messages in ${channel}.`,
      ephemeral: true,
    });
    return;
  }

  await suggestionManager.setChannel(interaction.guild.id, channel.id);

  await interaction.reply({ content: `✅ Suggestions will now be posted in ${channel}.`, ephemeral: true });
}

async function handleChannelRemove(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '⚠️ You need admin permissions to configure the suggestion channel.',
      ephemeral: true,
    });
    return;
  }

  await suggestionManager.removeChannel(interaction.guild.id);

  await interaction.reply({
    content: '✅ Suggestion channel removed. `/suggestion add` will be unavailable until a new one is set.',
    ephemeral: true,
  });
}

module.exports = { handleChannelSet, handleChannelRemove };
