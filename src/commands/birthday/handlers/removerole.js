const { PermissionFlagsBits } = require('discord.js');
const birthdayManager = require('../../../features/birthday/birthdayManager');
const { formatSeconds } = require('../../../utils/duration');

async function handleRemoveRole(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const timerInput = interaction.options.getString('timer');

  try {
    await birthdayManager.setRemoveAfterDuration(interaction.guildId, timerInput);
    const guildConfig = await birthdayManager.getGuildConfig(interaction.guildId);

    await interaction.reply({
      content: `✅ The birthday role will now be removed after **${formatSeconds(guildConfig.remove_after_seconds)}**.`,
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
