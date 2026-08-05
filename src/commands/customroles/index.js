const { SlashCommandBuilder } = require('discord.js');
const { handleLink } = require('./handlers/link');
const { handleUnlink } = require('./handlers/unlink');
const { handleList } = require('./handlers/list');
const { handleToggle } = require('./handlers/toggle');

const data = new SlashCommandBuilder()
  .setName('customrole')
  .setDescription('Tracks custom perk roles given to server boosters, so they auto-remove when the boost ends')
  .addSubcommand((sub) =>
    sub
      .setName('link')
      .setDescription('Associate a custom role with a booster, so it gets auto-removed if they stop boosting')
      .addUserOption((opt) => opt.setName('user').setDescription('The booster').setRequired(true))
      .addRoleOption((opt) => opt.setName('role').setDescription('Their custom perk role').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('unlink')
      .setDescription('Stop tracking a custom role for a user (does not remove the role itself)')
      .addUserOption((opt) => opt.setName('user').setDescription('The user').setRequired(true))
      .addRoleOption((opt) => opt.setName('role').setDescription('The role to stop tracking').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Lists tracked custom roles')
      .addUserOption((opt) => opt.setName('user').setDescription("Show only this user's tracked roles").setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName('toggle')
      .setDescription('Enables or disables custom role tracking for this server')
      .addBooleanOption((opt) =>
        opt.setName('enabled').setDescription('true to enable, false to disable').setRequired(true)
      )
  );

async function execute(interaction) {
  switch (interaction.options.getSubcommand()) {
    case 'link':
      return handleLink(interaction);
    case 'unlink':
      return handleUnlink(interaction);
    case 'list':
      return handleList(interaction);
    case 'toggle':
      return handleToggle(interaction);
    default:
      return undefined;
  }
}

module.exports = { data, execute };
