const { EmbedBuilder } = require('discord.js');
const birthdayManager = require('../../../features/birthday/birthdayManager');

const COLORE_EMBED = 0xff6fa5;
const LUNGHEZZA_MASSIMA_CAMPO = 1024; // limite di Discord per il valore di un field embed

function formattaData(date) {
  const gg = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${gg}/${mm}/${date.getFullYear()}`;
}

function formattaGiorniMancanti(daysUntil) {
  if (daysUntil === 0) return 'oggi! 🎉';
  if (daysUntil === 1) return 'domani';
  return `tra ${daysUntil} giorni`;
}

function tronca(testo, max) {
  if (testo.length <= max) return testo;
  return `${testo.slice(0, max - 1)}…`;
}

async function handleList(interaction) {
  const gruppi = await birthdayManager.getUpcomingBirthdaysGroupedByMonth(interaction.guildId);

  if (gruppi.length === 0) {
    await interaction.reply({
      content: "🎂 Nessun compleanno salvato ancora in questo server. Usa `/birthday add` per aggiungere il tuo!",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORE_EMBED)
    .setTitle(`🎂 Prossimi compleanni — ${interaction.guild.name}`)
    .setFooter({
      text: `Richiesto da ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

  const iconaServer = interaction.guild.iconURL();
  if (iconaServer) embed.setThumbnail(iconaServer);

  for (const gruppo of gruppi) {
    const righe = gruppo.entries.map(
      (e, i) => `${i + 1}. ${formattaData(e.date)} - <@${e.userId}> - ${formattaGiorniMancanti(e.daysUntil)}`
    );

    embed.addFields({
      name: gruppo.monthLabel,
      value: tronca(righe.join('\n'), LUNGHEZZA_MASSIMA_CAMPO),
    });
  }

  await interaction.reply({ embeds: [embed] });
}

module.exports = { handleList };
