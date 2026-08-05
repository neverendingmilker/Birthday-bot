const { PermissionFlagsBits } = require('discord.js');
const incidentManager = require('../../../features/incident/incidentManager');

async function handleChannelSet(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.options.getChannel('channel');

  await interaction.deferReply({ ephemeral: true });

  await incidentManager.setChannel(interaction.guildId, channel.id);

  const botMember = interaction.guild.members.me;
  const canPost =
    botMember &&
    channel
      .permissionsFor(botMember)
      ?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]);

  if (!canPost) {
    await interaction.editReply({
      content:
        `✅ Sign channel set to ${channel}\n` +
        `⚠️ Heads up: I don't currently have permission to view/send messages/attach files there. Please grant me those permissions.`,
    });
    return;
  }

  // Post the sign right away with whatever count is currently set (0 if this is
  // the first time the channel is configured for this guild).
  const result = await incidentManager.postUpdate(interaction.client, interaction.guildId);
  if (result.posted) {
    await interaction.editReply({ content: `✅ Sign channel set to ${channel}. Sign posted!` });
  } else {
    await interaction.editReply({
      content: `✅ Sign channel set to ${channel}, but I couldn't post the sign right now (${result.reason}).`,
    });
  }
}

module.exports = { handleChannelSet };
