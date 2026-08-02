const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

async function handleChannel(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.options.getChannel('channel');
  await verifyManager.setVerifiedChannel(interaction.guildId, channel.id);

  let message = `✅ Verification reports will now be posted in ${channel}`;

  const botMember = interaction.guild.members.me;
  const canSend = botMember && channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages);
  if (!canSend) {
    message += `\n⚠️ Heads up: I don't currently have permission to send messages in ${channel}. Please grant me "Send Messages" there.`;
  }

  await interaction.reply({ content: message, ephemeral: true });
}

module.exports = { handleChannel };
