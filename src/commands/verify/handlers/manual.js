const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');
const { performVerification } = require('./verifyAction');

const FINDOM_COLOR = 0xd4af37; // gold
const SUB_COLOR = 0x3498db; // blue

// Merges the old /verify findom and /verify sub subcommands into one, picked via `type`.
async function handleManual(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const type = interaction.options.getString('type'); // 'findom' | 'sub'
  const guildConfig = await verifyManager.getGuildConfig(interaction.guildId);

  if (type === 'findom') {
    await performVerification(interaction, {
      type: 'findom',
      roleId: guildConfig.findom_role_id,
      title: '✅ Findom Verification',
      color: FINDOM_COLOR,
    });
    return;
  }

  await performVerification(interaction, {
    type: 'sub',
    roleId: guildConfig.sub_role_id,
    title: '✅ Sub Verification',
    color: SUB_COLOR,
  });
}

module.exports = { handleManual };
