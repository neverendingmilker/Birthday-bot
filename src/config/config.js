require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  timezone: process.env.TZ || 'Europe/Rome',
  port: process.env.PORT || 3000,

  turso: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  },

  quiz: {
    roundDurationSeconds: Number(process.env.QUIZ_ROUND_DURATION_SECONDS || 30),
  },
};
