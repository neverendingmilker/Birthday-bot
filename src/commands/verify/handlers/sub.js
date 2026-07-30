const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');
const { performVerification } = require('./verifyAction');

const SUB_COLOR = 0x3498db; // blue

async function handleSub(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const guildConfig = await verifyManager.getGuildConfig(interaction.guildId);

  await performVerification(interaction, {
    type: 'sub',
    roleId: guildConfig.sub_role_id,
    title: '✅ Sub Verification',
    color: SUB_COLOR,
  });
}

module.exports = { handleSub };
