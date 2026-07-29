const { EmbedBuilder } = require('discord.js');
const animeNightManager = require('../../../features/animenight/animeNightManager');

const EMBED_COLOR = 0x8e6fff;
const MAX_FIELD_LENGTH = 1024; // Discord's limit for an embed field value

// Groups lines into chunks that each fit within Discord's per-field character limit.
function chunkLines(lines, maxLength) {
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLength) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

async function handleList(interaction) {
  const order = interaction.options.getString('order') || 'alphabetical';
  const entries = await animeNightManager.getSortedList(interaction.guildId, order);

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
  const chunks = chunkLines(lines, MAX_FIELD_LENGTH);

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`📺 Mystery Anime Night — ${interaction.guild.name}`)
    .setFooter({
      text: `${entries.length} anime logged • sorted ${order === 'date' ? 'by date watched' : 'alphabetically'}`,
    });

  chunks.forEach((chunk, i) => {
    embed.addFields({ name: chunks.length > 1 ? `Anime (part ${i + 1})` : 'Anime', value: chunk });
  });

  await interaction.reply({ embeds: [embed] });
}

module.exports = { handleList };
