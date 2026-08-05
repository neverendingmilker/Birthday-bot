const { PermissionFlagsBits } = require('discord.js');
const customRoleManager = require('../../../features/customroles/customRoleManager');

async function handleUnlink(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const user = interaction.options.getUser('user');
  const role = interaction.options.getRole('role');

  if (role) {
    await customRoleManager.unlink(interaction.guildId, user.id, role.id);
    await interaction.reply({
      content: `✅ Stopped tracking ${role} for ${user}. The role itself was **not** removed from them.`,
      ephemeral: true,
    });
    return;
  }

  const removedCount = await customRoleManager.unlink(interaction.guildId, user.id, null);

  if (removedCount === 0) {
    await interaction.reply({ content: `${user} had no tracked custom roles.`, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `✅ Stopped tracking all ${removedCount} custom role(s) linked to ${user}. The roles themselves were **not** removed from them.`,
    ephemeral: true,
  });
}

module.exports = { handleUnlink };
