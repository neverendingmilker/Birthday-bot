const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { handleManual } = require('./handlers/manual');
const { handleEdit } = require('./handlers/edit');
const { handleConfig } = require('./handlers/config');
const { handleCheck } = require('./handlers/check');
const {
  handleComboRolesAdd,
  handleComboRolesList,
  handleComboRolesRemove,
} = require('./handlers/comboroles');

const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('User verification management')
  .addSubcommand((sub) =>
    sub
      .setName('manual')
      .setDescription('[Admin] Verify a user as Findom or Sub')
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Which kind of verification')
          .setRequired(true)
          .addChoices({ name: 'Findom', value: 'findom' }, { name: 'Sub', value: 'sub' })
      )
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
      .setName('config')
      .setDescription('[Admin] Configure /verify manual roles and the report channel')
      .addRoleOption((opt) =>
        opt.setName('findom').setDescription('Role to assign for Findom verification').setRequired(false)
      )
      .addRoleOption((opt) =>
        opt.setName('sub').setDescription('Role to assign for Sub verification').setRequired(false)
      )
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel for verification reports')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('check')
      .setDescription("[Admin] Auto-assign a role based on the user's other roles (see /verify comboroles)")
      .addUserOption((opt) => opt.setName('user').setDescription('User to check').setRequired(true))
  )
  .addSubcommandGroup((group) =>
    group
      .setName('comboroles')
      .setDescription('[Admin] Configure custom "has all these roles -> gets this role" rules for /verify check')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('[Admin] Add a new combo rule')
          .addRoleOption((opt) =>
            opt.setName('target').setDescription('Role to assign when the member has all the trigger roles').setRequired(true)
          )
          .addRoleOption((opt) => opt.setName('role1').setDescription('Trigger role (required)').setRequired(true))
          .addRoleOption((opt) => opt.setName('role2').setDescription('Trigger role (optional)').setRequired(false))
          .addRoleOption((opt) => opt.setName('role3').setDescription('Trigger role (optional)').setRequired(false))
          .addRoleOption((opt) => opt.setName('role4').setDescription('Trigger role (optional)').setRequired(false))
          .addRoleOption((opt) => opt.setName('role5').setDescription('Trigger role (optional)').setRequired(false))
          .addRoleOption((opt) =>
            opt
              .setName('remove')
              .setDescription('Optional: role to remove from the member once this rule matches')
              .setRequired(false)
          )
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('[Admin] List the configured combo rules'))
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('[Admin] Remove a combo rule')
          .addIntegerOption((opt) =>
            opt.setName('id').setDescription('Rule ID, shown by /verify comboroles list').setRequired(true)
          )
      )
  );

async function execute(interaction) {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  if (group === 'comboroles') {
    switch (sub) {
      case 'add':
        return handleComboRolesAdd(interaction);
      case 'list':
        return handleComboRolesList(interaction);
      case 'remove':
        return handleComboRolesRemove(interaction);
      default:
        return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  }

  switch (sub) {
    case 'manual':
      return handleManual(interaction);
    case 'edit':
      return handleEdit(interaction);
    case 'config':
      return handleConfig(interaction);
    case 'check':
      return handleCheck(interaction);
    default:
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

module.exports = { data, execute };
