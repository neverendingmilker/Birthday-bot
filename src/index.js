const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config/config');
const { loadCommands } = require('./utils/loadCommands');
const { loadEvents } = require('./utils/loadEvents');
const health = require('./health');

if (!config.token || !config.clientId) {
  console.error('❌ DISCORD_TOKEN e CLIENT_ID devono essere impostati nel file .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // necessario per assegnare/rimuovere ruoli e fare fetch dei membri
  ],
});

client.commands = loadCommands();
loadEvents(client);

client.login(config.token);

// Nessuna dashboard: solo una paginetta di stato, per soddisfare il requisito di Render
// (hosting configurato come "Web Service") di avere una porta HTTP aperta.
health.start(client);
