const { PermissionFlagsBits } = require('discord.js');
const boosterLinkManager = require('../../../features/boosterlinks/boosterLinkManager');

async function handleToggle(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const enabled = interaction.options.getBoolean('enabled');

  await boosterLinkManager.setEnabled(interaction.guildId, enabled);

  await interaction.reply({
    content: enabled
      ? '✅ Custom role tracking is now **enabled**. Boosters who stop boosting will have their linked roles auto-removed again.'
      : '✅ Custom role tracking is now **disabled**. Existing links are kept, but no roles will be auto-removed until you re-enable it.',
    ephemeral: true,
  });
}

module.exports = { handleToggle };
