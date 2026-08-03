const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { handleCreate } = require('./handlers/create');
const { handleEdit } = require('./handlers/edit');
const { handleApprove, handleReject } = require('./handlers/decide');
const { handleChannelSet, handleChannelRemove } = require('./handlers/channel');
const { handleList } = require('./handlers/list');

const data = new SlashCommandBuilder()
  .setName('suggestion')
  .setDescription('Suggestion management')
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Submit a new suggestion')
      .addStringOption((opt) =>
        opt.setName('text').setDescription('Your suggestion').setMaxLength(1000).setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Edit one of your own pending suggestions')
      .addIntegerOption((opt) =>
        opt.setName('number').setDescription('Suggestion number (e.g. 12)').setMinValue(1).setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('text').setDescription('New text for the suggestion').setMaxLength(1000).setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Show all suggestions still waiting for a decision')
  )
  .addSubcommand((sub) =>
    sub
      .setName('approve')
      .setDescription('[Admin] Approve a suggestion')
      .addIntegerOption((opt) =>
        opt.setName('number').setDescription('Suggestion number (e.g. 12)').setMinValue(1).setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('reject')
      .setDescription('[Admin] Reject a suggestion')
      .addIntegerOption((opt) =>
        opt.setName('number').setDescription('Suggestion number (e.g. 12)').setMinValue(1).setRequired(true)
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName('channel')
      .setDescription('[Admin] Configure where suggestions get posted')
      .addSubcommand((sub) =>
        sub
          .setName('set')
          .setDescription('Set (or replace) the channel where suggestions are posted')
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Channel for suggestions')
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
              .setRequired(true)
          )
      )
      .addSubcommand((sub) => sub.setName('remove').setDescription('Remove the configured suggestion channel'))
  );

async function execute(interaction) {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  if (group === 'channel') {
    if (sub === 'set') return handleChannelSet(interaction);
    if (sub === 'remove') return handleChannelRemove(interaction);
    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }

  switch (sub) {
    case 'create':
      return handleCreate(interaction);
    case 'edit':
      return handleEdit(interaction);
    case 'list':
      return handleList(interaction);
    case 'approve':
      return handleApprove(interaction);
    case 'reject':
      return handleReject(interaction);
    default:
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

module.exports = { data, execute };
