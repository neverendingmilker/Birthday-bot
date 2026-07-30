const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

async function handleRoles(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const findomRole = interaction.options.getRole('findom');
  const subRole = interaction.options.getRole('sub');
  const maledommeRole = interaction.options.getRole('maledomme');

  if (!findomRole && !subRole && !maledommeRole) {
    await interaction.reply({
      content: '⚠️ Provide at least one role to set (`findom`, `sub` and/or `maledomme`).',
      ephemeral: true,
    });
    return;
  }

  const updates = [];

  if (findomRole) {
    await verifyManager.setFindomRole(interaction.guildId, findomRole.id);
    updates.push(`Findom role set to ${findomRole}`);
  }
  if (subRole) {
    await verifyManager.setSubRole(interaction.guildId, subRole.id);
    updates.push(`Sub role set to ${subRole}`);
  }
  if (maledommeRole) {
    await verifyManager.setMaledommeRole(interaction.guildId, maledommeRole.id);
    updates.push(`Maledomme role set to ${maledommeRole}`);
  }

  await interaction.reply({ content: `✅ ${updates.join('\n✅ ')}`, ephemeral: true });
}

module.exports = { handleRoles };
