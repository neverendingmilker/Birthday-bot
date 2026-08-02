const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config/config');
const { loadCommands } = require('./utils/loadCommands');
const { loadEvents } = require('./utils/loadEvents');
const health = require('./health');

if (!config.token || !config.clientId) {
  console.error('❌ DISCORD_TOKEN and CLIENT_ID must be set in the .env file');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // needed to assign/remove roles and fetch members
    GatewayIntentBits.GuildVoiceStates, // needed by the quiz feature to join/play in voice channels
    GatewayIntentBits.GuildMessages, // needed by the quiz feature to read chat answers
    GatewayIntentBits.MessageContent, // needed by the quiz feature to read chat answers' text
  ],
});

client.commands = loadCommands();
loadEvents(client);

client.login(config.token);

// No dashboard: just a small status page, to satisfy Render's requirement
// (hosting configured as a "Web Service") of having an open HTTP port.
health.start(client);
