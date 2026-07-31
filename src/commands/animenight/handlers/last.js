const { EmbedBuilder } = require('discord.js');
const animeNightManager = require('../../../features/animenight/animeNightManager');
const { sendPaginated } = require('../../../utils/pagination');

const EMBED_COLOR = 0x8e6fff;
const ENTRIES_PER_PAGE = 15;

async function handleLast(interaction) {
  const sessions = await animeNightManager.getSessionsList(interaction.guildId);

  if (sessions.length === 0) {
    await interaction.reply({
      content: "📺 No anime logged yet for Mystery Anime Night. Use `/animenight add` to start the list!",
      ephemeral: true,
    });
    return;
  }

  // Sessions are sorted chronologically ascending, so the last one is the most recent.
  const lastSession = sessions[sessions.length - 1];
  const titles = lastSession.titles;
  const totalPages = Math.ceil(titles.length / ENTRIES_PER_PAGE);

  const buildEmbed = (page) => {
    const start = page * ENTRIES_PER_PAGE;
    const pageTitles = titles.slice(start, start + ENTRIES_PER_PAGE);
    const lines = pageTitles.map((title, i) => `${start + i + 1}. ${title}`);

    return new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`📺 ${lastSession.label}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `page ${page + 1}/${totalPages}` });
  };

  await sendPaginated(interaction, totalPages, buildEmbed);
}

module.exports = { handleLast };
