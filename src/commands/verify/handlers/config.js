const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

// Merges the old /verify roles and /verify channel subcommands into one: all options
// are optional, provide any combination.
async function handleConfig(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const findomRole = interaction.options.getRole('findom');
  const subRole = interaction.options.getRole('sub');
  const channel = interaction.options.getChannel('channel');

  if (!findomRole && !subRole && !channel) {
    await interaction.reply({
      content: '⚠️ Provide at least one setting to change (`findom`, `sub` and/or `channel`).',
      ephemeral: true,
    });
    return;
  }

  const messages = [];

  if (findomRole) {
    await verifyManager.setFindomRole(interaction.guildId, findomRole.id);
    messages.push(`✅ Findom role set to ${findomRole}`);
  }
  if (subRole) {
    await verifyManager.setSubRole(interaction.guildId, subRole.id);
    messages.push(`✅ Sub role set to ${subRole}`);
  }
  if (channel) {
    await verifyManager.setVerifiedChannel(interaction.guildId, channel.id);
    const botMember = interaction.guild.members.me;
    const canSend = botMember && channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages);
    if (!canSend) {
      messages.push(
        `✅ Verification reports will now be posted in ${channel}\n` +
          `⚠️ Heads up: I don't currently have permission to send messages in ${channel}. Please grant me "Send Messages" there.`
      );
    } else {
      messages.push(`✅ Verification reports will now be posted in ${channel}`);
    }
  }

  await interaction.reply({ content: messages.join('\n'), ephemeral: true });
}

module.exports = { handleConfig };
