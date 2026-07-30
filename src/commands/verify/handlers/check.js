const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

// Looks up a role on the guild by name, case-insensitively. Only used for "Age verified",
// which isn't part of the combo-rule system (it just tracks whether the member holds any
// configured target role).
function findRoleByName(guild, name) {
  return guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

// Adds/removes "Age verified" so it tracks whether the member ends up holding any of the
// target roles configured via /verify comboroles.
async function syncAgeVerified(guild, member, botMember, hasAnyVerifiedRole) {
  const ageRole = findRoleByName(guild, verifyManager.ROLE_NAMES.ageVerified);
  if (!ageRole) return '';

  if (botMember.roles.highest.position <= ageRole.position) {
    return hasAnyVerifiedRole && !member.roles.cache.has(ageRole.id)
      ? ' ⚠️ Couldn\'t add "Age verified": my role needs to be moved higher in the role list.'
      : '';
  }

  if (hasAnyVerifiedRole && !member.roles.cache.has(ageRole.id)) {
    await member.roles.add(ageRole);
    return ' "Age verified" was added.';
  }
  if (!hasAnyVerifiedRole && member.roles.cache.has(ageRole.id)) {
    await member.roles.remove(ageRole);
    return ' "Age verified" was removed.';
  }
  return '';
}

// Auto-assigns a role based on the combo rules configured via /verify comboroles: a member
// holding ALL of a rule's trigger roles gets that rule's target role. Matches by role ID,
// so emoji/whitespace/text differences in role names never cause a mismatch.
async function handleCheck(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  const guild = interaction.guild;

  const member = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "⚠️ Couldn't find that user in this server.", ephemeral: true });
    return;
  }

  const botMember = guild.members.me;
  const comboRules = await verifyManager.listComboRules(interaction.guildId);

  if (comboRules.length === 0) {
    await interaction.reply({
      content: '⚠️ No combo rules configured yet. Use `/verify comboroles add` to create one first.',
      ephemeral: true,
    });
    return;
  }

  const memberRoleIds = [...member.roles.cache.keys()];
  const winningRule = verifyManager.determineComboRule(comboRules, memberRoleIds);

  if (!winningRule) {
    await interaction.reply({
      content:
        `⚠️ ${targetUser} doesn't match any configured combo rule. Check \`/verify comboroles list\` ` +
        `against the roles they currently hold.`,
      ephemeral: true,
    });
    return;
  }

  const targetRole = guild.roles.cache.get(winningRule.target_role_id);
  if (!targetRole) {
    await interaction.reply({
      content: `⚠️ Rule #${winningRule.id} points to a role that no longer exists on this server.`,
      ephemeral: true,
    });
    return;
  }

  if (!botMember || botMember.roles.highest.position <= targetRole.position) {
    await interaction.reply({
      content: `⚠️ I can't assign ${targetRole}: my role needs to be moved higher in the server's role list.`,
      ephemeral: true,
    });
    return;
  }

  // Keep all configured target roles mutually exclusive: drop any other one the
  // member already holds before adding the winning one.
  const allTargetIds = [...new Set(comboRules.map((r) => r.target_role_id))];
  for (const otherId of allTargetIds) {
    if (otherId === targetRole.id) continue;
    const otherRole = guild.roles.cache.get(otherId);
    if (otherRole && member.roles.cache.has(otherRole.id) && botMember.roles.highest.position > otherRole.position) {
      await member.roles.remove(otherRole);
    }
  }

  const alreadyHadIt = member.roles.cache.has(targetRole.id);
  if (!alreadyHadIt) {
    await member.roles.add(targetRole);
  }

  let removeNote = '';
  if (winningRule.remove_role_id) {
    const removeRole = guild.roles.cache.get(winningRule.remove_role_id);
    if (removeRole && member.roles.cache.has(removeRole.id)) {
      if (botMember.roles.highest.position > removeRole.position) {
        await member.roles.remove(removeRole);
        removeNote = ` ${removeRole} was removed.`;
      } else {
        removeNote = ` ⚠️ Couldn't remove ${removeRole}: my role needs to be moved higher in the role list.`;
      }
    }
  }

  const hasAnyVerifiedRole = allTargetIds.some((id) => member.roles.cache.has(id));
  const ageVerifiedNote = await syncAgeVerified(guild, member, botMember, hasAnyVerifiedRole);

  await interaction.reply({
    content: alreadyHadIt
      ? `✅ ${targetUser} already had ${targetRole} (no change needed).${removeNote}${ageVerifiedNote}`
      : `✅ ${targetUser} verified: assigned ${targetRole} (rule #${winningRule.id}).${removeNote}${ageVerifiedNote}`,
    ephemeral: true,
  });
}

module.exports = { handleCheck };
