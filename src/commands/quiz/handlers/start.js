const quizManager = require('../../../features/quiz/quizManager');
const {
  fetchTracksFromSource,
  fetchDeezerChartTracks,
  fetchDeezerGenres,
  fetchRandomTracksByCategory,
  fetchSpecialCategoryTracks,
  fetchTracksByArtistName,
} = require('../../../features/quiz/musicSource');

async function handleStart(interaction) {
  const guild = interaction.guild;

  if (quizManager.isActive(guild.id)) {
    await interaction.reply('⚠️ A quiz is already running in this server.');
    return;
  }

  const member = await guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice?.channel;
  if (!voiceChannel) {
    await interaction.reply('❌ You need to be in a voice channel to start the quiz.');
    return;
  }

  const songs = interaction.options.getInteger('songs');
  const mode = interaction.options.getString('mode');
  const source = interaction.options.getString('source');
  const category = interaction.options.getString('category');
  const artist = interaction.options.getString('artist');
  const duration = interaction.options.getInteger('duration') ?? quizManager.defaultRoundDuration;

  // Immediate ack (Discord requires a response within 3 seconds)
  await interaction.reply('🔎 Getting the songs ready, one moment...');
  const channel = interaction.channel;

  let tracks;
  try {
    if (source && source.trim().toLowerCase() !== 'random') {
      if (category || artist) {
        await channel.send(
          "ℹ️ The `category`/`artist` parameters are ignored when you specify a `source` (playlist/tracks)."
        );
      }
      tracks = await withTimeout(fetchTracksFromSource(source.trim()), 45000);
    } else if (artist) {
      tracks = await withTimeout(fetchTracksByArtistName(artist.trim(), Math.max(songs * 3, 30)), 45000);
    } else if (category) {
      if (category.startsWith('special:')) {
        const key = category.split(':')[1];
        tracks = await withTimeout(fetchSpecialCategoryTracks(key, Math.max(songs * 3, 30)), 45000);
      } else {
        const genreId = category.startsWith('genre:') ? Number(category.split(':')[1]) : Number(category);
        let genreName = 'Pop';
        try {
          const genres = await fetchDeezerGenres();
          const match = genres.find((g) => g.id === genreId);
          if (match) genreName = match.name;
        } catch {
          // keep default genreName
        }
        tracks = await withTimeout(
          fetchRandomTracksByCategory(genreName, genreId, Math.max(songs * 3, 30)),
          45000
        );
      }
    } else {
      tracks = await withTimeout(fetchDeezerChartTracks(Math.max(songs * 3, 30)), 45000);
    }
  } catch (err) {
    if (err.message === 'timeout') {
      await channel.send('❌ Fetching songs took too long (slow/unreachable network). Try `/quiz start` again.');
    } else {
      await channel.send(`❌ Error while fetching songs: \`${err.message}\``);
    }
    return;
  }

  if (!tracks || !tracks.length) {
    await channel.send('❌ No songs found for this category/artist/source, aborting startup.');
    return;
  }

  let rounds = songs;
  if (tracks.length < rounds) {
    await channel.send(
      `⚠️ I only found ${tracks.length} available songs: I'll do ${tracks.length} round(s) instead of ${rounds}.`
    );
    rounds = tracks.length;
  }

  try {
    await quizManager.startQuiz(guild, voiceChannel, channel, { rounds, roundDuration: duration, mode, tracks });
  } catch (err) {
    await channel.send(`❌ Could not join the voice channel: \`${err.message}\``);
    return;
  }

  const modeLabel = mode === 'open_answer' ? 'open answer' : 'multiple choice (4 buttons)';
  await channel.send(
    `🎬 Quiz started: **${rounds} round(s)**, **${duration}s** per round, **${modeLabel}** mode. Get ready!`
  );
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

module.exports = { handleStart };
