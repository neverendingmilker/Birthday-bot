const { SlashCommandBuilder } = require('discord.js');
const { handleStart } = require('./handlers/start');
const { handleStop } = require('./handlers/stop');
const { handleLeaderboard } = require('./handlers/leaderboard');
const { handleReset } = require('./handlers/reset');
const { handleHelp } = require('./handlers/help');
const { fetchDeezerGenres, searchDeezerArtists, SPECIAL_CATEGORIES } = require('../../features/quiz/musicSource');

const data = new SlashCommandBuilder()
  .setName('quiz')
  .setDescription('Music quiz')
  .addSubcommand((sub) =>
    sub
      .setName('start')
      .setDescription('Start the music quiz')
      .addIntegerOption((opt) =>
        opt.setName('songs').setDescription('How many songs to play (e.g. 10)').setMinValue(1).setMaxValue(100).setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('mode')
          .setDescription('How answers work: type freely, or pick from 4 buttons')
          .setRequired(true)
          .addChoices(
            { name: 'Open answer (type title/artist)', value: 'open_answer' },
            { name: 'Multiple choice (4 buttons)', value: 'multiple_choice' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('source')
          .setDescription(
            'Spotify/Deezer/iTunes link (playlist, single track, or comma-separated links). Empty = random'
          )
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('Genre or special category (decades, J-Pop, K-Pop, anime, etc). Ignored if you use source/artist')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('artist')
          .setDescription("A specific artist's name (typo-tolerant). Ignored if you use source")
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('duration')
          .setDescription('Duration of each round in seconds (default 30)')
          .setMinValue(5)
          .setMaxValue(120)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) => sub.setName('stop').setDescription('Stop the current quiz'))
  .addSubcommand((sub) => sub.setName('leaderboard').setDescription("Show the server's overall leaderboard"))
  .addSubcommand((sub) => sub.setName('reset').setDescription("Reset the server's leaderboard"))
  .addSubcommand((sub) => sub.setName('help').setDescription('Show help for the music quiz'));

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'start':
      return handleStart(interaction);
    case 'stop':
      return handleStop(interaction);
    case 'leaderboard':
      return handleLeaderboard(interaction);
    case 'reset':
      return handleReset(interaction);
    case 'help':
      return handleHelp(interaction);
    default:
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

// Powers autocomplete for both "category" (Deezer genres + special
// categories: decades, J-Pop, K-Pop, anime, etc.) and "artist" (live Deezer
// artist search) on /quiz start.
async function autocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  const query = (focused.value || '').toLowerCase();

  if (focused.name === 'category') {
    let genres = [];
    try {
      genres = await fetchDeezerGenres();
    } catch {
      genres = [];
    }

    const choices = genres
      .filter((g) => g.name.toLowerCase().includes(query))
      .map((g) => ({ name: g.name, value: `genre:${g.id}` }));

    choices.push(
      ...Object.entries(SPECIAL_CATEGORIES)
        .filter(([, info]) => info.label.toLowerCase().includes(query))
        .map(([key, info]) => ({ name: info.label, value: `special:${key}` }))
    );

    await interaction.respond(choices.slice(0, 25));
    return;
  }

  if (focused.name === 'artist') {
    if (!query || query.trim().length < 2) {
      await interaction.respond([]);
      return;
    }
    let candidates = [];
    try {
      candidates = await searchDeezerArtists(query.trim(), 15);
    } catch {
      candidates = [];
    }
    await interaction.respond(candidates.slice(0, 25).map((c) => ({ name: c.name, value: c.name })));
    return;
  }

  await interaction.respond([]);
}

module.exports = { data, execute, autocomplete };
