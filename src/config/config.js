require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  timezone: process.env.TZ || 'Europe/Rome',

  turso: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },

  web: {
    // Se manca il client secret, la dashboard resta disattivata (il bot funziona comunque via slash command)
    clientSecret: process.env.DISCORD_CLIENT_SECRET || null,
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    sessionSecret: process.env.SESSION_SECRET || 'cambia-questo-segreto',
    port: process.env.PORT || process.env.WEB_PORT || 3000,
  },
};
