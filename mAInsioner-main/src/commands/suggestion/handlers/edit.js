const suggestionManager = require('../../../features/suggestion/suggestionManager');

async function handleEdit(interaction) {
  const number = interaction.options.getInteger('number');
  const newContent = interaction.options.getString('text');

  const suggestion = await suggestionManager.getSuggestion(interaction.guild.id, number);
  if (!suggestion) {
    await interaction.reply({ content: `⚠️ No suggestion found with number **#${number}**.`, ephemeral: true });
    return;
  }

  if (suggestion.user_id !== interaction.user.id) {
    await interaction.reply({ content: '⚠️ You can only edit your own suggestions.', ephemeral: true });
    return;
  }

  if (suggestion.status !== 'pending') {
    await interaction.reply({
      content: `⚠️ Suggestion **#${number}** has already been decided and can no longer be edited.`,
      ephemeral: true,
    });
    return;
  }

  await suggestionManager.editContent(interaction.guild, number, newContent);

  await interaction.reply({ content: `✅ Suggestion **#${number}** updated.`, ephemeral: true });
}

module.exports = { handleEdit };
