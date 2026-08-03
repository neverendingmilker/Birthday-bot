const { PermissionFlagsBits } = require('discord.js');
const birthdayManager = require('../../../features/birthday/birthdayManager');

async function handleRemove(interaction) {
  const targetUser = interaction.options.getUser('user'); // optional, admin-only
  const isForSomeoneElse = targetUser && targetUser.id !== interaction.user.id;

  if (isForSomeoneElse && !interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to remove someone else\'s birthday.',
      ephemeral: true,
    });
    return;
  }

  const user = targetUser || interaction.user;

  const existing = await birthdayManager.getBirthday(interaction.guildId, user.id);
  if (!existing) {
    await interaction.reply({
      content: isForSomeoneElse
        ? `⚠️ ${user} doesn't have a birthday saved.`
        : "⚠️ You don't have a birthday saved.",
      ephemeral: true,
    });
    return;
  }

  await birthdayManager.removeBirthday(interaction.guildId, user.id);

  await interaction.reply({
    content: isForSomeoneElse ? `🗑️ Removed the saved birthday for ${user}.` : '🗑️ Your birthday has been removed.',
    ephemeral: true,
  });
}

module.exports = { handleRemove };
