const { REST, Routes } = require('discord.js');
const config = require('./config/config');
const { loadCommands } = require('./utils/loadCommands');

async function deploy() {
  const commands = loadCommands();
  const body = commands.map((c) => c.data.toJSON());

  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  console.log(
    config.guildId
      ? `Registering ${body.length} command(s) on guild ${config.guildId} (instant)...`
      : `Registering ${body.length} command(s) globally (can take up to 1h to propagate)...`
  );

  await rest.put(route, { body });

  console.log('✅ Commands registered successfully.');
}

deploy().catch((err) => {
  console.error('❌ Error registering commands:', err);
  process.exit(1);
});
