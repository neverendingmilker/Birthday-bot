const quizRepository = require('../../../features/quiz/quizRepository');

async function handleLeaderboard(interaction) {
  const top = await quizRepository.leaderboard(interaction.guildId);
  if (!top.length) {
    await interaction.reply('No scores recorded yet.');
    return;
  }
  const lines = top.map((row, i) => `${i + 1}. **${row.username}** — ${row.points} point(s)`).join('\n');
  await interaction.reply(`🏆 Leaderboard:\n${lines}`);
}

module.exports = { handleLeaderboard };
