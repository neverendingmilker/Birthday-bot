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
  const sinceYearStart = interaction.options.getBoolean('since_year_start') ?? false;
  const sinceDateInput = interaction.options.getString('since_date') ?? undefined;
  const untilDateInput = interaction.options.getString('until_date') ?? undefined;
  const contentType = interaction.options.getString('content_type') ?? undefined;
  const emojisInput = interaction.options.getString('emojis') ?? undefined;
  const threshold = interaction.options.getInteger('threshold') ?? undefined;

  // Scanning message history (and, in Reactions mode, fetching users per reaction) can
  // take a while on a busy channel — defer so Discord doesn't time out the interaction.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let stats;
  try {
    stats = await starboardManager.runLookback(interaction.guild, name, {
      limit,
      sinceYearStart,
      sinceDateInput,
      untilDateInput,
      contentType,
      emojisInput,
      threshold,
    });
  } catch (err) {
    if (err instanceof starboardManager.ValidationError) {
      await interaction.editReply({ content: `⚠️ ${err.message}` });
      return;
    }
    throw err;
  }

  const startBound = sinceDateInput ? `since ${sinceDateInput}` : sinceYearStart ? 'since January 1st' : null;
  const endBound = untilDateInput ? `until ${untilDateInput}` : null;
  const scope = startBound || endBound ? [startBound, endBound].filter(Boolean).join(' ') : `across the last ${limit} messages`;

  const filterNote = ` (filter: **${starboardManager.CONTENT_TYPES[stats.contentType]}**`;
  const overrideNote =
    stats.votingMethod === 'reactions' && (emojisInput !== undefined || threshold !== undefined)
      ? `, emojis: **${starboardManager.formatEmojisForDisplay(stats.emojis)}**, threshold: **${stats.threshold}**)`
      : ')';

  const errorNote =
    stats.errors > 0
      ? ` ⚠️ **${stats.errors}** message${stats.errors === 1 ? '' : 's'} couldn't be checked due to an error — you can safely run this again to retry them.`
      : '';
  const summary =
    stats.votingMethod === 'buttons'
      ? `✅ Scanned **${stats.scanned}** messages ${scope}${filterNote}${overrideNote} and added a vote button to **${stats.buttonsAdded}** that didn't have one yet.${errorNote}`
      : `✅ Scanned **${stats.scanned}** messages ${scope}${filterNote}${overrideNote} — **${stats.qualified}** newly made it onto the starboard.${errorNote}`;

  // A very long scan can outlast the interaction token's 15-minute lifetime — by this
  // point the actual work above is already done and saved either way, so a failed
  // reply here just means the summary itself couldn't be delivered, not that the scan
  // failed silently.
  await interaction.editReply({ content: summary }).catch((err) => {
    console.warn('[starboard] Lookback finished but the summary reply could not be sent (interaction likely expired):', err.message);
  });
}

module.exports = { handleLookback };
