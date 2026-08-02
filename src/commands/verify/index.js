const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { handleFindom } = require('./handlers/findom');
const { handleSub } = require('./handlers/sub');
const { handleEdit } = require('./handlers/edit');
const { handleRoles } = require('./handlers/roles');
const { handleChannel } = require('./handlers/channel');

const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('User verification management')
  .addSubcommand((sub) =>
    sub
      .setName('findom')
      .setDescription('[Admin] Verify a user as Findom')
      .addUserOption((opt) => opt.setName('user').setDescription('User to verify').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('method').setDescription('How the verification was done').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('social').setDescription('Social media / handle (optional)').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('sub')
      .setDescription('[Admin] Verify a user as Sub')
      .addUserOption((opt) => opt.setName('user').setDescription('User to verify').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('method').setDescription('How the verification was done').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('social').setDescription('Social media / handle (optional)').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('[Admin] Edit an existing verification record')
      .addUserOption((opt) => opt.setName('user').setDescription('Verified user').setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Which verification to edit')
          .setRequired(true)
          .addChoices({ name: 'Findom', value: 'findom' }, { name: 'Sub', value: 'sub' })
      )
      .addStringOption((opt) => opt.setName('social').setDescription('New Social value').setRequired(false))
      .addStringOption((opt) =>
        opt.setName('method').setDescription('New verification method').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('roles')
      .setDescription('[Admin] Set the roles assigned by /verify findom and /verify sub')
      .addRoleOption((opt) =>
        opt.setName('findom').setDescription('Role to assign for Findom verification').setRequired(false)
      )
      .addRoleOption((opt) =>
        opt.setName('sub').setDescription('Role to assign for Sub verification').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('channel')
      .setDescription('[Admin] Set the channel where verification reports are posted')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel for verification reports')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'findom':
      return handleFindom(interaction);
    case 'sub':
      return handleSub(interaction);
    case 'edit':
      return handleEdit(interaction);
    case 'roles':
      return handleRoles(interaction);
    case 'channel':
      return handleChannel(interaction);
    default:
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

module.exports = { data, execute };
