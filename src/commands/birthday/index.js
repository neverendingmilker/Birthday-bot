const { SlashCommandBuilder } = require('discord.js');
const { handleAdd } = require('./handlers/add');
const { handleRole } = require('./handlers/role');
const { handleRemoveRole } = require('./handlers/removerole');
const { handleList } = require('./handlers/list');

const data = new SlashCommandBuilder()
  .setName('birthday')
  .setDescription('Birthday management')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add (or update) your birthday')
      .addIntegerOption((opt) =>
        opt.setName('day').setDescription('Day (1-31)').setMinValue(1).setMaxValue(31).setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('month').setDescription('Month (1-12)').setMinValue(1).setMaxValue(12).setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('year').setDescription('Year of birth (optional)').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('role')
      .setDescription('[Admin] Set the role to assign on someone\'s birthday')
      .addRoleOption((opt) =>
        opt.setName('role').setDescription('Role to assign').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('removerole')
      .setDescription('[Admin] Set after how many hours to remove the birthday role')
      .addIntegerOption((opt) =>
        opt
          .setName('timer')
          .setDescription('Number of hours after which the role is removed (default 24)')
          .setMinValue(1)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Show all birthdays in this server, grouped by month')
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'add':
      return handleAdd(interaction);
    case 'role':
      return handleRole(interaction);
    case 'removerole':
      return handleRemoveRole(interaction);
    case 'list':
      return handleList(interaction);
    default:
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

module.exports = { data, execute };
