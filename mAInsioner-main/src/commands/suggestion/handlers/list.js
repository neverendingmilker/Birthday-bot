const { EmbedBuilder } = require('discord.js');
const suggestionManager = require('../../../features/suggestion/suggestionManager');
const { sendPaginated } = require('../../../utils/pagination');

const EMBED_COLOR = 0xf1c40f;
const PER_PAGE = 10;
const PREVIEW_LENGTH = 100;

async function handleList(interaction) {
  const pending = await suggestionManager.listPending(interaction.guild.id);

  if (pending.length === 0) {
    await interaction.reply({ content: '✅ No suggestions are waiting for a decision.', ephemeral: false });
    return;
  }

  const totalPages = Math.ceil(pending.length / PER_PAGE);

  const buildEmbed = (pageIndex) => {
    const pageItems = pending.slice(pageIndex * PER_PAGE, pageIndex * PER_PAGE + PER_PAGE);
    const lines = pageItems.map((s) => {
      const preview = s.content.length > PREVIEW_LENGTH ? `${s.content.slice(0, PREVIEW_LENGTH)}…` : s.content;
      return `**#${s.number}** — <@${s.user_id}>: ${preview.replace(/\n/g, ' ')}`;
    });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`🕐 Pending suggestions — ${interaction.guild.name}`)
      .setDescription(lines.join('\n'))
      .setFooter({
        text:
          totalPages > 1
            ? `Requested by ${interaction.user.username} • Page ${pageIndex + 1}/${totalPages}`
            : `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    return embed;
  };

  await sendPaginated(interaction, totalPages, buildEmbed);
}

module.exports = { handleList };
