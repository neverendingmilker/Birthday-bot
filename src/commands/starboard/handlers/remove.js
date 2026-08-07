const { PermissionFlagsBits } = require('discord.js');
const starboardManager = require('../../../features/starboard/starboardManager');

async function handleRemove(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: '❌ You need the "Manage Server" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const name = interaction.options.getString('name');
  const removedCount = await starboardManager.remove(interaction.guildId, name);

  if (removedCount === 0) {
    await interaction.reply({ content: `No starboard named "${name}" found in this server.`, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `✅ Starboard **${name}** removed. Already-posted messages are left as-is, but won't be updated anymore.`,
    ephemeral: true,
  });
}

module.exports = { handleRemove };
