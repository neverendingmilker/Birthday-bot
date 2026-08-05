const { PermissionFlagsBits } = require('discord.js');
const incidentManager = require('../../../features/incident/incidentManager');

async function handleSetNumber(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const numero = interaction.options.getInteger('numero');

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await incidentManager.setCount(interaction.client, interaction.guildId, numero);
    if (result.posted) {
      await interaction.editReply({ content: `✅ Counter set to **${numero}**. Sign updated!` });
    } else {
      await interaction.editReply({
        content: `✅ Counter set to **${numero}**, but the sign couldn't be posted (${result.reason}). Configure the channel with \`/incident channel\` first.`,
      });
    }
  } catch (err) {
    if (err instanceof incidentManager.ValidationError) {
      await interaction.editReply({ content: `⚠️ ${err.message}` });
      return;
    }
    throw err;
  }
}

module.exports = { handleSetNumber };
