const { PermissionFlagsBits } = require('discord.js');
const birthdayManager = require('../../../features/birthday/birthdayManager');

async function handleRemoveRole(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ Ti serve il permesso "Gestisci Ruoli" per usare questo comando.',
      ephemeral: true,
    });
    return;
  }

  const ore = interaction.options.getInteger('timer');

  try {
    await birthdayManager.setRemoveAfterHours(interaction.guildId, ore);
    await interaction.reply({
      content: `✅ Il ruolo compleanno verra' rimosso dopo **${ore} ore**.`,
      ephemeral: true,
    });
  } catch (err) {
    if (err instanceof birthdayManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
    } else {
      throw err;
    }
  }
}

module.exports = { handleRemoveRole };
