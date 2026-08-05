const { PermissionFlagsBits } = require('discord.js');
const roleLinkManager = require('../../../features/rolelinks/roleLinkManager');

async function handleToggle(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const enabled = interaction.options.getBoolean('enabled');

  await roleLinkManager.setEnabled(interaction.guildId, enabled);

  await interaction.reply({
    content: enabled
      ? '✅ Role link tracking is now **enabled**. Losing a linked role will remove its paired role again.'
      : '✅ Role link tracking is now **disabled**. Existing links are kept, but no roles will be auto-removed until you re-enable it.',
    ephemeral: true,
  });
}

module.exports = { handleToggle };
