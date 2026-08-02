const quizRepository = require('../../../features/quiz/quizRepository');

async function handleReset(interaction) {
  await quizRepository.reset(interaction.guildId);
  await interaction.reply('🔄 Leaderboard reset.');
}

module.exports = { handleReset };
