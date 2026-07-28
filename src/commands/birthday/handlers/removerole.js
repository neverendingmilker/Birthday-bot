const { PermissionFlagsBits } = require('discord.js');
const birthdayManager = require('../../../features/birthday/birthdayManager');

async function handleRemoveRole(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const hours = interaction.options.getInteger('timer');

  try {
    await birthdayManager.setRemoveAfterHours(interaction.guildId, hours);
    await interaction.reply({
      content: `✅ The birthday role will now be removed after **${hours} hours**.`,
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
