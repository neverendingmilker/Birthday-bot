const { SlashCommandBuilder } = require('discord.js');
const { handleAdd } = require('./handlers/add');
const { handleList } = require('./handlers/list');
const { handleLast } = require('./handlers/last');

const data = new SlashCommandBuilder()
  .setName('animenight')
  .setDescription('Mystery Anime Night watch list')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('[Admin] Add one or more anime to the watched list')
      .addStringOption((opt) =>
        opt
          .setName('titles')
          .setDescription('Anime title(s). Separate multiple with a comma or a slash, e.g. "Naruto, Bleach"')
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('date')
          .setDescription('Date watched, DD/MM or DD/MM/YYYY (default: today)')
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Show the full watched anime list')
      .addStringOption((opt) =>
        opt
          .setName('order')
          .setDescription('Sort order (default: alphabetical)')
          .addChoices(
            { name: 'Alphabetical', value: 'alphabetical' },
            { name: 'Date watched', value: 'date' }
          )
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('last')
      .setDescription('Show only the most recently added anime')
      .addIntegerOption((opt) =>
        opt
          .setName('count')
          .setDescription('How many to show (default 10, max 50)')
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(false)
      )
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'add':
      return handleAdd(interaction);
    case 'list':
      return handleList(interaction);
    case 'last':
      return handleLast(interaction);
    default:
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

module.exports = { data, execute };
