const { EmbedBuilder } = require('discord.js');
const birthdayManager = require('../../../features/birthday/birthdayManager');

const EMBED_COLOR = 0xff6fa5;
const MAX_FIELD_LENGTH = 1024; // Discord's limit for an embed field value

function formatDay(date) {
  return String(date.getDate()).padStart(2, '0');
}

function formatDaysLeft(daysUntil) {
  if (daysUntil === 0) return 'today! 🎉';
  if (daysUntil === 1) return 'tomorrow';
  return `in ${daysUntil} days`;
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

async function handleList(interaction) {
  const groups = await birthdayManager.getBirthdaysGroupedByMonth(interaction.guildId);

  if (groups.length === 0) {
    await interaction.reply({
      content: "🎂 No birthdays saved yet in this server. Use `/birthday add` to add yours!",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`🎂 Birthdays — ${interaction.guild.name}`)
    .setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

  const guildIcon = interaction.guild.iconURL();
  if (guildIcon) embed.setThumbnail(guildIcon);

  for (const group of groups) {
    const lines = group.entries.map(
      (e, i) => `${i + 1}. ${formatDay(e.date)} - <@${e.userId}> - ${formatDaysLeft(e.daysUntil)}`
    );

    embed.addFields({
      name: group.monthLabel,
      value: truncate(lines.join('\n'), MAX_FIELD_LENGTH),
    });
  }

  await interaction.reply({ embeds: [embed] });
}

module.exports = { handleList };
