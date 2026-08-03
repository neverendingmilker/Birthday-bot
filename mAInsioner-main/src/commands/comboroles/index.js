const { SlashCommandBuilder } = require('discord.js');
const { handleRun } = require('./handlers/run');

const data = new SlashCommandBuilder()
  .setName('comboroles')
  .setDescription('Shows the users who have all the given roles (optionally excluding others with BUT)')
  .addRoleOption((opt) => opt.setName('role1').setDescription('First required role').setRequired(true))
  .addRoleOption((opt) => opt.setName('role2').setDescription('Second required role').setRequired(true))
  .addRoleOption((opt) => opt.setName('role3').setDescription('Third required role (optional)').setRequired(false))
  .addRoleOption((opt) => opt.setName('role4').setDescription('Fourth required role (optional)').setRequired(false))
  .addRoleOption((opt) => opt.setName('role5').setDescription('Fifth required role (optional)').setRequired(false))
  .addRoleOption((opt) =>
    opt.setName('but1').setDescription('BUT: exclude anyone who also has this role (optional)').setRequired(false)
  )
  .addRoleOption((opt) =>
    opt.setName('but2').setDescription('BUT: exclude anyone who also has this role (optional)').setRequired(false)
  )
  .addRoleOption((opt) =>
    opt.setName('but3').setDescription('BUT: exclude anyone who also has this role (optional)').setRequired(false)
  );

async function execute(interaction) {
  return handleRun(interaction);
}

module.exports = { data, execute };
