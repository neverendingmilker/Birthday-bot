const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

// Scans src/commands: every subfolder (one per feature) must have an index.js
// exporting { data, execute }. This way, adding a new bot feature just means
// creating a new folder here, with no changes to the rest of the code.
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
      console.warn(`[loadCommands] Feature "${entry.name}" does not export { data, execute }, skipping.`);
      continue;
    }

    commands.set(command.data.name, command);
  }

  return commands;
}

module.exports = { loadCommands };
