const birthdayManager = require('../../../features/birthday/birthdayManager');

async function handleAdd(interaction) {
  const day = interaction.options.getInteger('giorno');
  const month = interaction.options.getInteger('mese');
  const year = interaction.options.getInteger('anno'); // puo' essere null, e' facoltativo

  try {
    await birthdayManager.addBirthday(interaction.guildId, interaction.user.id, day, month, year);

    const dataStr = year ? `${day}/${month}/${year}` : `${day}/${month}`;
    await interaction.reply({
      content: `🎂 Compleanno salvato: **${dataStr}**`,
      ephemeral: true,
    });
  } catch (err) {
    if (err instanceof birthdayManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
    } else {
      throw err;
    }
  }
}

module.exports = { handleAdd };
