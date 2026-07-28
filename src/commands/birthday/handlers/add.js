const birthdayManager = require('../../../features/birthday/birthdayManager');
const { assignBirthdayRoleIfDue } = require('../../../features/birthday/birthdayScheduler');

async function handleAdd(interaction) {
  const day = interaction.options.getInteger('day');
  const month = interaction.options.getInteger('month');
  const year = interaction.options.getInteger('year'); // optional, can be null

  try {
    await birthdayManager.addBirthday(interaction.guildId, interaction.user.id, day, month, year);

    const dateStr = year ? `${day}/${month}/${year}` : `${day}/${month}`;
    let message = `🎂 Birthday saved: **${dateStr}**`;

    // If today happens to be the birthday just saved, assign the role right away
    // instead of waiting for tonight's midnight check (which has already run today).
    const result = await assignBirthdayRoleIfDue(
      interaction.client,
      interaction.guildId,
      interaction.user.id,
      day,
      month
    );

    if (result.assigned) {
      message += "\n🎉 It's your birthday today — I've given you the birthday role!";
    } else if (result.reason === 'role_too_high') {
      message +=
        "\n⚠️ Today is your birthday, but I couldn't assign the role: my role needs to be moved higher in the server's role list.";
    }

    await interaction.reply({ content: message, ephemeral: true });
  } catch (err) {
    if (err instanceof birthdayManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
    } else {
      throw err;
    }
  }
}

module.exports = { handleAdd };
