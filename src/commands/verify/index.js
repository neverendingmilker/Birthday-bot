const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { handleConfig } = require('./handlers/config');
const { handleVerifyType } = require('./handlers/verifyAction');

const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('User verification management')
  .addSubcommand((sub) =>
    sub
      .setName('config')
      .setDescription('[Admin] Configure the give/remove roles and report channel for sub, domme and maledom')
      .addRoleOption((opt) => opt.setName('subgive').setDescription('Role to give for /verify sub').setRequired(false))
      .addRoleOption((opt) =>
        opt.setName('subremove').setDescription('Role to remove (if present) for /verify sub').setRequired(false)
      )
      .addRoleOption((opt) =>
        opt.setName('dommegive').setDescription('Role to give for /verify domme').setRequired(false)
      )
      .addRoleOption((opt) =>
        opt.setName('dommeremove').setDescription('Role to remove (if present) for /verify domme').setRequired(false)
      )
      .addRoleOption((opt) =>
        opt.setName('maledomgive').setDescription('Role to give for /verify maledom').setRequired(false)
      )
      .addRoleOption((opt) =>
        opt
          .setName('maledomremove')
          .setDescription('Role to remove (if present) for /verify maledom')
          .setRequired(false)
      )
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel where verification reports are posted')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('sub')
      .setDescription('[Admin] Verify a user as Sub')
      .addUserOption((opt) => opt.setName('user').setDescription('User to verify').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('domme')
      .setDescription('[Admin] Verify a user as Domme')
      .addUserOption((opt) => opt.setName('user').setDescription('User to verify').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('maledom')
      .setDescription('[Admin] Verify a user as Maledom')
      .addUserOption((opt) => opt.setName('user').setDescription('User to verify').setRequired(true))
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'config':
      return handleConfig(interaction);
    case 'sub':
      return handleVerifyType(interaction, 'sub');
    case 'domme':
      return handleVerifyType(interaction, 'domme');
    case 'maledom':
      return handleVerifyType(interaction, 'maledom');
    default:
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

module.exports = { data, execute };
