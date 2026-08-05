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

  await customRoleManager.unlink(interaction.guildId, user.id, role.id);

  await interaction.reply({
    content: `✅ Stopped tracking ${role} for ${user}. The role itself was **not** removed from them.`,
    ephemeral: true,
  });
}

module.exports = { handleUnlink };
