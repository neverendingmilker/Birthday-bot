const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { handleAdd } = require('./handlers/add');
const { handleRole } = require('./handlers/role');
const { handleRemoveRole } = require('./handlers/removerole');
const { handleList } = require('./handlers/list');
const { handleChannel } = require('./handlers/channel');

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
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('[Admin only] Set the birthday for someone else instead of yourself')
          .setRequired(false)
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
      .setDescription('[Admin] Set after how long to remove the birthday role')
      .addStringOption((opt) =>
        opt
          .setName('timer')
          .setDescription('e.g. 30s, 10m, 24h, 3d (min 10s, max 30d, default 24h)')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('channel')
      .setDescription('[Admin] Set the channel where automatic birthday greetings are posted')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel for birthday greetings')
          .addChannelTypes(ChannelType.GuildText)
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
    case 'channel':
      return handleChannel(interaction);
    case 'list':
      return handleList(interaction);
    default:
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

module.exports = { data, execute };
