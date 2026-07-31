const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

// Shared logic behind /verify sub, /verify domme and /verify maledom: assigns the
// role configured (via /verify config) for that type, and removes the paired
// "remove" role if the member currently holds it.
async function handleVerifyType(interaction, type) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const label = verifyManager.TYPE_LABELS[type];
  const targetUser = interaction.options.getUser('user');
  const guild = interaction.guild;

  const config = await verifyManager.getGuildConfig(interaction.guildId);
  const { giveRoleId, removeRoleId } = verifyManager.getRoleIdsForType(config, type);

  if (!giveRoleId) {
    await interaction.reply({
      content: `⚠️ No role is configured for **${label}** yet. Set one with \`/verify config\` first.`,
      ephemeral: true,
    });
    return;
  }

  const member = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "⚠️ Couldn't find that user in this server.", ephemeral: true });
    return;
  }

  const giveRole = guild.roles.cache.get(giveRoleId);
  if (!giveRole) {
    await interaction.reply({
      content: `⚠️ The role configured to give for **${label}** no longer exists on this server. Set a new one with \`/verify config\`.`,
      ephemeral: true,
    });
    return;
  }

  const botMember = guild.members.me;
  if (!botMember || botMember.roles.highest.position <= giveRole.position) {
    await interaction.reply({
      content: `⚠️ I can't assign ${giveRole}: my role needs to be moved higher in the server's role list.`,
      ephemeral: true,
    });
    return;
  }

  const notes = [];

  const alreadyHadIt = member.roles.cache.has(giveRole.id);
  if (alreadyHadIt) {
    notes.push(`✅ Already had ${giveRole} (no change needed).`);
  } else {
    await member.roles.add(giveRole);
    notes.push(`✅ Assigned ${giveRole}.`);
  }

  if (removeRoleId) {
    const removeRole = guild.roles.cache.get(removeRoleId);
    if (!removeRole) {
      notes.push(`⚠️ The role configured to remove for **${label}** no longer exists on this server.`);
    } else if (member.roles.cache.has(removeRole.id)) {
      if (botMember.roles.highest.position > removeRole.position) {
        await member.roles.remove(removeRole);
        notes.push(`🗑️ Removed ${removeRole}.`);
      } else {
        notes.push(`⚠️ Couldn't remove ${removeRole}: my role needs to be moved higher in the server's role list.`);
      }
    }
  }

  // TODO: once the report format is defined, post it to
  // `config.report_channel_id` here (if set) — after the role changes above,
  // so the report reflects what actually happened (including any ⚠️ notes).

  await interaction.reply({
    content: `${targetUser} verified as **${label}**:\n${notes.join('\n')}`,
    ephemeral: true,
  });
}

module.exports = { handleVerifyType };
