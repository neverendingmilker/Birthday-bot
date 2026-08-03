const { PermissionFlagsBits } = require('discord.js');
const suggestionManager = require('../../../features/suggestion/suggestionManager');

async function decide(interaction, status, verb, pastTense) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: `⚠️ You need admin permissions to ${verb} suggestions.`, ephemeral: true });
    return;
  }

  const number = interaction.options.getInteger('number');

  const suggestion = await suggestionManager.getSuggestion(interaction.guild.id, number);
  if (!suggestion) {
    await interaction.reply({ content: `⚠️ No suggestion found with number **#${number}**.`, ephemeral: true });
    return;
  }

  if (suggestion.status !== 'pending') {
    await interaction.reply({
      content: `⚠️ Suggestion **#${number}** has already been decided.`,
      ephemeral: true,
    });
    return;
  }

  await suggestionManager.setStatus(interaction.guild, number, status, interaction.user.id);

  await interaction.reply({ content: `✅ Suggestion **#${number}** ${pastTense}.`, ephemeral: true });
}

async function handleApprove(interaction) {
  return decide(interaction, 'approved', 'approve', 'approved');
}

async function handleReject(interaction) {
  return decide(interaction, 'denied', 'reject', 'rejected');
}

module.exports = { handleApprove, handleReject };
