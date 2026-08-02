const { EmbedBuilder } = require('discord.js');

async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎵 Music Quiz — Commands')
    .setColor(0x5865f2)
    .setDescription(
      '`/quiz start` — start the quiz: pick songs, source, category, ' +
        'artist, mode and round duration right in the slash command menu\n' +
        '`/quiz stop` — stop the quiz\n' +
        '`/quiz leaderboard` — show the leaderboard\n' +
        '`/quiz reset` — reset the leaderboard\n\n' +
        '**Open answer mode:** first to type the **title** gets **2 points**, ' +
        'first to type the **artist** gets **1 point**.\n' +
        '**Multiple choice mode:** 4 buttons, one attempt each. First correct ' +
        'click gets **3 points**. Answers are private (ephemeral) until the ' +
        "round ends, so nobody spoils it for anyone else.\n" +
        "Small typos, casing, 'feat.', '(Remix)' etc. are ignored.\n" +
        'The overall leaderboard is shown after every round.'
    );

  await interaction.reply({ embeds: [embed] });
}

module.exports = { handleHelp };
