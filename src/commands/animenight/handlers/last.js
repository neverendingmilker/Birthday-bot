const { EmbedBuilder } = require('discord.js');
const animeNightManager = require('../../../features/animenight/animeNightManager');

const EMBED_COLOR = 0x8e6fff;
const DEFAULT_COUNT = 10;
const MAX_COUNT = 50;

async function handleLast(interaction) {
  const requestedCount = interaction.options.getInteger('count') || DEFAULT_COUNT;
  const count = Math.min(Math.max(requestedCount, 1), MAX_COUNT);

  const entries = await animeNightManager.getLast(interaction.guildId, count);

  if (entries.length === 0) {
    await interaction.reply({
      content: "📺 No anime logged yet for Mystery Anime Night. Use `/animenight add` to start the list!",
      ephemeral: true,
    });
    return;
  }

  const lines = entries.map(
    (e, i) => `${i + 1}. ${e.title} — ${animeNightManager.formatDisplayDate(e.watched_date)}`
  );

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`📺 Last ${entries.length} anime added — ${interaction.guild.name}`)
    .setDescription(lines.join('\n'));

  await interaction.reply({ embeds: [embed] });
}

module.exports = { handleLast };
