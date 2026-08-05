const { PermissionFlagsBits } = require('discord.js');
const incidentManager = require('../../../features/incident/incidentManager');

async function handleReset(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const result = await incidentManager.reset(interaction.client, interaction.guildId);
  if (result.posted) {
    await interaction.editReply({ content: '✅ Counter reset to **0**. Sign updated!' });
  } else {
    await interaction.editReply({
      content: `✅ Counter reset to **0**, but the sign couldn't be posted (${result.reason}). Configure the channel with \`/incident channel\` first.`,
    });
  }
}

module.exports = { handleReset };
