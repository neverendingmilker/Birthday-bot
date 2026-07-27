const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

// Scansiona src/commands: ogni sottocartella (una per feature) deve avere un index.js
// che esporta { data, execute }. In questo modo per aggiungere una nuova funzione al bot
// basta creare una nuova cartella qui dentro, senza toccare il resto del codice.
function loadCommands() {
  const commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');

  const entries = fs.readdirSync(commandsPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const commandModulePath = path.join(commandsPath, entry.name, 'index.js');
    if (!fs.existsSync(commandModulePath)) continue;

    const command = require(commandModulePath);

    if (!command.data || !command.execute) {
      console.warn(`[loadCommands] La feature "${entry.name}" non esporta { data, execute }, saltata.`);
      continue;
    }

    commands.set(command.data.name, command);
  }

  return commands;
}

module.exports = { loadCommands };
