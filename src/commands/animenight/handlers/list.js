const { EmbedBuilder } = require('discord.js');
const animeNightManager = require('../../../features/animenight/animeNightManager');
const { sendPaginated } = require('../../../utils/pagination');

const EMBED_COLOR = 0x8e6fff;
const SESSIONS_PER_PAGE = 10;
const MAX_FIELD_LENGTH = 1024; // Discord's limit for an embed field value

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

async function handleList(interaction) {
  const order = interaction.options.getString('order') || 'alphabetical';
  const sessions = await animeNightManager.getSessionsList(interaction.guildId);

  if (sessions.length === 0) {
    await interaction.reply({
      content: "📺 No anime logged yet for Mystery Anime Night. Use `/animenight add` to start the list!",
      ephemeral: true,
    });
    return;
  }

  // Sessions themselves always stay in chronological order (that's what "session number"
  // means); "order" only controls how titles are sorted WITHIN each session.
  const displaySessions = sessions.map((s) => ({
    ...s,
    titles: order === 'alphabetical' ? [...s.titles].sort((a, b) => a.localeCompare(b)) : s.titles,
  }));

  const totalAnime = sessions.reduce((sum, s) => sum + s.titles.length, 0);
  const totalPages = Math.ceil(displaySessions.length / SESSIONS_PER_PAGE);

  const buildEmbed = (page) => {
    const start = page * SESSIONS_PER_PAGE;
    const pageSessions = displaySessions.slice(start, start + SESSIONS_PER_PAGE);

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`📺 Mystery Anime Night — ${interaction.guild.name}`)
      .setFooter({
        text: `${sessions.length} session(s) • ${totalAnime} anime logged • page ${page + 1}/${totalPages}`,
      });

    for (const session of pageSessions) {
      const value = session.titles.map((title) => `• ${title}`).join('\n');
      embed.addFields({
        name: `Mystery Anime Night ${session.number} — ${animeNightManager.formatDisplayDate(session.date)}`,
        value: truncate(value, MAX_FIELD_LENGTH),
      });
    }

    return embed;
  };

  await sendPaginated(interaction, totalPages, buildEmbed);
}

module.exports = { handleList };
