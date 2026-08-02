const quizManager = require('../../../features/quiz/quizManager');

async function handleStop(interaction) {
  const stopped = quizManager.stopQuiz(interaction.guildId);
  if (!stopped) {
    await interaction.reply("There's no quiz running right now.");
    return;
  }
  await interaction.reply('🛑 Quiz stopped.');
}

module.exports = { handleStop };
