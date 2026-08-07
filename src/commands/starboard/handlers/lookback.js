const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const starboardManager = require('../../../features/starboard/starboardManager');

async function handleLookback(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: '❌ You need the "Manage Server" permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const name = interaction.options.getString('name');
  const limit = interaction.options.getInteger('limit') ?? starboardManager.LOOKBACK_DEFAULT_LIMIT;

  // Scanning message history (and, in Reactions mode, fetching users per reaction) can
  // take a while on a busy channel — defer so Discord doesn't time out the interaction.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let stats;
  try {
    stats = await starboardManager.runLookback(interaction.guild, name, limit);
  } catch (err) {
    if (err instanceof starboardManager.ValidationError) {
      await interaction.editReply({ content: `⚠️ ${err.message}` });
      return;
    }
    throw err;
  }

  const summary =
    stats.votingMethod === 'buttons'
      ? `✅ Scanned **${stats.scanned}** messages and added a vote button to **${stats.buttonsAdded}** that didn't have one yet.`
      : `✅ Scanned **${stats.scanned}** messages — **${stats.qualified}** newly made it onto the starboard.`;

  await interaction.editReply({ content: summary });
}

module.exports = { handleLookback };
