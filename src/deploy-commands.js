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
      ? `Registrazione di ${body.length} comandi sul server ${config.guildId} (istantanea)...`
      : `Registrazione di ${body.length} comandi globalmente (fino a 1h per propagarsi)...`
  );

  await rest.put(route, { body });

  console.log('✅ Comandi registrati con successo.');
}

deploy().catch((err) => {
  console.error('❌ Errore registrando i comandi:', err);
  process.exit(1);
});
