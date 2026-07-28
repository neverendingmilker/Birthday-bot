const { PermissionFlagsBits } = require('discord.js');
const birthdayManager = require('../../../features/birthday/birthdayManager');
const { assignDueTodayForGuild } = require('../../../features/birthday/birthdayScheduler');

async function handleRole(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const role = interaction.options.getRole('role');

  await birthdayManager.setBirthdayRole(interaction.guildId, role.id);

  let message = `✅ The birthday role has been set to ${role}`;

  const botMember = interaction.guild.members.me;
  if (botMember && botMember.roles.highest.position <= role.position) {
    message += `\n⚠️ Heads up: my own role is currently **not** higher than ${role} in the server's role list, so I won't actually be able to assign or remove it. Please move my role above it in Server Settings → Roles.`;
  } else {
    // Hierarchy looks fine: check if anyone is already celebrating today and assign right away,
    // in case the role wasn't configured yet when their birthday check ran this morning.
    const results = await assignDueTodayForGuild(interaction.client, interaction.guildId);
    const assignedCount = results.filter((r) => r.assigned).length;
    if (assignedCount > 0) {
      message += `\n🎉 Also assigned it right away to ${assignedCount} member(s) celebrating today.`;
    }
  }

  await interaction.reply({ content: message, ephemeral: true });
}

module.exports = { handleRole };
