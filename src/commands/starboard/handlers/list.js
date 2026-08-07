const { EmbedBuilder } = require('discord.js');
const starboardManager = require('../../../features/starboard/starboardManager');

const EMBED_COLOR = 0xffd166;

async function handleList(interaction) {
  const boards = await starboardManager.listAll(interaction.guildId);

  if (boards.length === 0) {
    await interaction.reply({ content: 'No starboards are currently configured in this server.', ephemeral: true });
    return;
  }

  const lines = boards.map((b) => {
    const emojis = starboardManager.formatEmojisForDisplay(JSON.parse(b.emojis));
    const contentTypeLabel = starboardManager.CONTENT_TYPES[b.content_type] ?? b.content_type;
    const votingLabel = starboardManager.VOTING_METHODS[b.voting_method] ?? b.voting_method;
    return `**${b.name}** — <#${b.watch_channel_id}> → <#${b.post_channel_id}> · **${b.threshold}+** ${emojis} · ${contentTypeLabel} · ${votingLabel}`;
  });

  const embed = new EmbedBuilder().setColor(EMBED_COLOR).setTitle('Starboards').setDescription(lines.join('\n'));

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { handleList };
