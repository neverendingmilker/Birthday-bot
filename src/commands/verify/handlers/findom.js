const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');
const { performVerification } = require('./verifyAction');

const FINDOM_COLOR = 0xd4af37; // gold

async function handleFindom(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const guildConfig = await verifyManager.getGuildConfig(interaction.guildId);

  await performVerification(interaction, {
    type: 'findom',
    roleId: guildConfig.findom_role_id,
    title: '✅ Findom Verification',
    color: FINDOM_COLOR,
  });
}

module.exports = { handleFindom };
