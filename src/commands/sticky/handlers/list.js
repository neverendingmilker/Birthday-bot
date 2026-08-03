const { EmbedBuilder } = require('discord.js');
const stickyManager = require('../../../features/sticky/stickyManager');

const EMBED_COLOR = 0x5865f2;
const PREVIEW_LENGTH = 80;

async function handleList(interaction) {
  const stickies = stickyManager.listByGuild(interaction.guild.id);

  const embed = new EmbedBuilder().setColor(EMBED_COLOR).setTitle('📌 Sticky messages');

  if (stickies.length === 0) {
    embed.setDescription('No sticky messages are configured in this server.');
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const lines = stickies.map((s) => {
    const preview = s.content.length > PREVIEW_LENGTH ? `${s.content.slice(0, PREVIEW_LENGTH)}…` : s.content;
    return `<#${s.channelId}> — ${preview.replace(/\n/g, ' ')}`;
  });

  embed.setDescription(lines.join('\n'));
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { handleList };
