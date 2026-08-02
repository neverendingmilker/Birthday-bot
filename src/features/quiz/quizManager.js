// Music quiz game engine: per-guild state, round loop, voice playback.
//
// Scoring rules:
//   - OPEN ANSWER mode: first to type the correct TITLE -> 2 points,
//     first to type the correct ARTIST -> 1 point (independent).
//   - MULTIPLE CHOICE mode: 4 buttons, one attempt per person. Answers are
//     ephemeral (only visible to the person who clicked), so nobody can
//     spoil the result for others. First correct click -> 3 points
//     (title+artist together). The round ends early once everyone
//     currently in the voice channel has answered, otherwise it waits for
//     the full round duration.
//   - The overall leaderboard is shown after every round.

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus,
} = require('@discordjs/voice');
const { FFmpeg } = require('prism-media');
const ffmpegPath = require('ffmpeg-static');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const config = require('../../config/config');
const quizRepository = require('./quizRepository');
const { isCloseMatch, anyArtistMatch } = require('./matching');
const { resolvePlayableUrl } = require('./musicSource');

process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegPath;

const SECONDS_BETWEEN_ROUNDS = 5;
const MAX_TRACK_FETCH_ATTEMPTS = 5;

/** @type {Map<string, GuildGameState>} */
const gameStates = new Map();

class GuildGameState {
  constructor() {
    this.tracks = [];
    this.usedIndexes = new Set();
    this.voiceConnection = null;
    this.audioPlayer = null;
    this.textChannel = null;
    this.active = false;
    this.roundState = null;
  }
}

class RoundState {
  constructor(track, mode) {
    this.track = track;
    this.title = track.name;
    this.artists = track.artists;
    this.titleAwarded = false;
    this.artistAwarded = false;
    this.mode = mode; // "open_answer" or "multiple_choice"
    this.correctNumber = null;
    this.options = null;
    // Only used in multiple_choice mode (buttons):
    this.answeredUsers = new Set(); // who already clicked a button (1 attempt each)
    this.expectedUsers = new Set(); // who was in voice when the round started
    this.message = null;
    this._resolveWait = null;
    this.waitPromise = new Promise((resolve) => {
      this._resolveWait = resolve;
    });
  }

  finish() {
    if (this._resolveWait) {
      this._resolveWait();
      this._resolveWait = null;
    }
  }
}

function getState(guildId) {
  if (!gameStates.has(guildId)) {
    gameStates.set(guildId, new GuildGameState());
  }
  return gameStates.get(guildId);
}

function isActive(guildId) {
  return getState(guildId).active;
}

function buildMultipleChoiceOptions(track, allTracks) {
  const decoyPool = allTracks.filter((t) => t !== track);
  shuffleInPlace(decoyPool);
  const decoys = decoyPool.slice(0, 3);

  const options = shuffleInPlace([...decoys, track]);
  const correctNumber = options.indexOf(track) + 1;
  return { options, correctNumber };
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function truncateLabel(label, max = 80) {
  return label.length > max ? `${label.slice(0, max - 3)}...` : label;
}

function buildChoiceButtonsRow(options) {
  const row = new ActionRowBuilder();
  options.forEach((opt, i) => {
    const label = truncateLabel(`${i + 1}) ${opt.name} — ${opt.artists.join(', ')}`);
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`quiz:choice:${i + 1}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Primary)
    );
  });
  return row;
}

async function pickNextTrack(state) {
  const remaining = [...state.tracks.keys()].filter((i) => !state.usedIndexes.has(i));
  shuffleInPlace(remaining);

  let attempts = 0;
  for (const idx of remaining) {
    if (attempts >= MAX_TRACK_FETCH_ATTEMPTS) break;
    attempts += 1;
    const track = state.tracks[idx];
    let audioUrl = null;
    try {
      audioUrl = await withTimeout(resolvePlayableUrl(track), 15000);
    } catch {
      audioUrl = null;
    }
    state.usedIndexes.add(idx);
    if (audioUrl) return { track, audioUrl };
  }

  return { track: null, audioUrl: null };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createResourceFromUrl(url) {
  const transcoder = new FFmpeg({
    args: [
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-i', url,
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
    ],
  });
  return createAudioResource(transcoder, { inputType: StreamType.Raw });
}

/**
 * Starts a quiz in the given guild. `options` = { rounds, roundDuration, mode, tracks }
 * `voiceChannel` = the discord.js VoiceChannel to join.
 * `textChannel` = the discord.js TextChannel to post round messages to.
 */
async function startQuiz(guild, voiceChannel, textChannel, options) {
  const state = getState(guild.id);
  state.tracks = options.tracks;
  state.usedIndexes = new Set();
  state.textChannel = textChannel;
  state.active = true;

  state.voiceConnection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });
  await entersState(state.voiceConnection, VoiceConnectionStatus.Ready, 15000);

  state.audioPlayer = createAudioPlayer();
  state.voiceConnection.subscribe(state.audioPlayer);

  runQuizLoop(guild.id, options.rounds, options.roundDuration, options.mode).catch((err) => {
    console.error('[quiz] Unexpected error in the game loop:', err);
  });
}

async function runQuizLoop(guildId, rounds, roundDuration, mode) {
  const state = getState(guildId);
  const channel = state.textChannel;

  try {
    for (let roundNumber = 1; roundNumber <= rounds; roundNumber++) {
      if (!state.active) break;

      const { track, audioUrl } = await pickNextTrack(state);
      if (!track) {
        await channel.send('⚠️ No more playable songs found, stopping here.');
        break;
      }

      const roundState = new RoundState(track, mode);
      state.roundState = roundState;

      const artistsDisplay = track.artists.join(', ');

      if (mode === 'multiple_choice') {
        const { options, correctNumber } = buildMultipleChoiceOptions(track, state.tracks);
        roundState.options = options;
        roundState.correctNumber = correctNumber;

        if (state.voiceConnection) {
          const vc = channel.guild.channels.cache.get(
            state.voiceConnection.joinConfig.channelId
          );
          if (vc) {
            roundState.expectedUsers = new Set(
              vc.members.filter((m) => !m.user.bot).map((m) => m.id)
            );
          }
        }

        const row = buildChoiceButtonsRow(options);
        roundState.message = await channel.send({
          content:
            `🎧 **Round ${roundNumber}/${rounds}** — now playing!\n` +
            `Click the button with what you think is the correct answer. ` +
            `Your answer is private — nobody else will see it until the round ends.`,
          components: [row],
        });
      } else {
        await channel.send(
          `🎧 **Round ${roundNumber}/${rounds}** — now playing! ` +
            `Type the **title** (+2) and the **artist** (+1) here in chat.`
        );
      }

      try {
        const resource = createResourceFromUrl(audioUrl);
        state.audioPlayer.play(resource);
      } catch (err) {
        await channel.send(`⚠️ Playback error, skipping this song: \`${err.message}\``);
        continue;
      }

      await Promise.race([roundState.waitPromise, sleep(roundDuration * 1000)]);

      if (state.audioPlayer && state.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
        state.audioPlayer.stop();
      }

      if (roundState.message) {
        const disabledRow = buildChoiceButtonsRow(roundState.options || []);
        disabledRow.components.forEach((c) => c.setDisabled(true));
        await roundState.message.edit({ components: [disabledRow] }).catch(() => null);
      }

      let reveal = `⏱️ Time's up! The song was: **${track.name}** — ${artistsDisplay}`;
      if (!roundState.titleAwarded && !roundState.artistAwarded) {
        reveal += '\nNobody got it this round 😅';
      }
      await channel.send(reveal);

      const top = await quizRepository.leaderboard(guildId);
      if (top.length) {
        const lines = top
          .map((row, i) => `${i + 1}. **${row.username}** — ${row.points} point(s)`)
          .join('\n');
        await channel.send(`📊 Overall leaderboard:\n${lines}`);
      } else {
        await channel.send('📊 No points scored yet.');
      }

      state.roundState = null;
      await sleep(SECONDS_BETWEEN_ROUNDS * 1000);
    }
  } finally {
    state.active = false;
    state.roundState = null;
    if (state.voiceConnection) {
      try {
        state.voiceConnection.destroy();
      } catch {
        // ignore
      }
      state.voiceConnection = null;
    }
    if (channel) {
      await channel.send('🏁 Quiz finished! Thanks for playing 🎶').catch(() => null);
    }
  }
}

function stopQuiz(guildId) {
  const state = getState(guildId);
  if (!state.active) return false;

  state.active = false;
  if (state.roundState) state.roundState.finish();
  return true;
}

// Called from the "quiz:choice:N" button interaction handler in interactionCreate.js.
async function handleButtonAnswer(interaction) {
  const guildId = interaction.guildId;
  const state = getState(guildId);
  const roundState = state.roundState;

  if (!roundState || roundState.mode !== 'multiple_choice') {
    await interaction.reply({ content: 'There is no active round right now.', ephemeral: true });
    return;
  }

  const choiceNumber = Number(interaction.customId.split(':')[2]);
  const userId = interaction.user.id;

  if (roundState.answeredUsers.has(userId)) {
    await interaction.reply({
      content: "You've already answered this round — wait for the next song!",
      ephemeral: true,
    });
    return;
  }

  roundState.answeredUsers.add(userId);
  const isCorrect = choiceNumber === roundState.correctNumber;

  if (isCorrect && !roundState.titleAwarded) {
    roundState.titleAwarded = true;
    roundState.artistAwarded = true;
    await quizRepository.addPoints(guildId, userId, interaction.user.tag, 3);
    await interaction.reply({
      content: "✅ Correct! +3 points (title+artist). Don't spoil it for the others 🤫",
      ephemeral: true,
    });
  } else if (isCorrect) {
    await interaction.reply({
      content: '✅ That was the right answer, but someone else was faster: no points this round.',
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: '❌ Wrong answer: no points this round (one attempt per person).',
      ephemeral: true,
    });
  }

  if (roundState.expectedUsers.size && [...roundState.expectedUsers].every((id) => roundState.answeredUsers.has(id))) {
    roundState.finish();
  }
}

// Called from the "messageCreate" event listener for open_answer mode.
async function handleChatAnswer(message) {
  if (message.author.bot || !message.guildId) return;

  const state = getState(message.guildId);
  const roundState = state.roundState;
  if (!roundState || roundState.mode !== 'open_answer') return;

  const text = message.content.trim();
  let awardedSomething = false;

  if (!roundState.titleAwarded && isCloseMatch(text, roundState.title)) {
    roundState.titleAwarded = true;
    await quizRepository.addPoints(message.guildId, message.author.id, message.author.tag, 2);
    await message.channel.send(`✅ ${message.author} got the **title**! +2 points`);
    awardedSomething = true;
  }

  if (!roundState.artistAwarded && anyArtistMatch(text, roundState.artists)) {
    roundState.artistAwarded = true;
    await quizRepository.addPoints(message.guildId, message.author.id, message.author.tag, 1);
    await message.channel.send(`✅ ${message.author} got the **artist**! +1 point`);
    awardedSomething = true;
  }

  if (awardedSomething && roundState.titleAwarded && roundState.artistAwarded) {
    roundState.finish();
  }
}

module.exports = {
  startQuiz,
  stopQuiz,
  isActive,
  handleButtonAnswer,
  handleChatAnswer,
  getState,
  defaultRoundDuration: config.quiz.roundDurationSeconds,
};
