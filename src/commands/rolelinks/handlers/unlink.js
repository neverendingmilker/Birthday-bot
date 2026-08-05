const { PermissionFlagsBits } = require('discord.js');
const roleLinkManager = require('../../../features/rolelinks/roleLinkManager');

async function handleUnlink(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const roleA = interaction.options.getRole('role1');
  const roleB = interaction.options.getRole('role2');

  const removedCount = await roleLinkManager.unlink(interaction.guildId, roleA.id, roleB.id);

  if (removedCount === 0) {
    await interaction.reply({
      content: `No link found from ${roleA} to ${roleB}. Check the order — role1 is the one that, when lost, removes role2.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({ content: `✅ Unlinked ${roleA} → ${roleB}.`, ephemeral: true });
}

module.exports = { handleUnlink };
