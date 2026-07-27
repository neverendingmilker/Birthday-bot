const { PermissionFlagsBits } = require('discord.js');
const birthdayManager = require('../../../features/birthday/birthdayManager');

async function handleRole(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ Ti serve il permesso "Gestisci Ruoli" per usare questo comando.',
      ephemeral: true,
    });
    return;
  }

  const role = interaction.options.getRole('ruolo');

  await birthdayManager.setBirthdayRole(interaction.guildId, role.id);

  await interaction.reply({
    content: `✅ Il ruolo compleanno e' stato impostato su ${role}`,
    ephemeral: true,
  });
}

module.exports = { handleRole };
