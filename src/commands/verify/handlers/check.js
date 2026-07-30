const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

// Looks up a role on the guild by name, case-insensitively.
function findRoleByName(guild, name) {
  return guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

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

  const memberRoleNames = member.roles.cache.map((r) => r.name);
  const targetRoleName = verifyManager.determineVerifiedRoleName(memberRoleNames);

  if (!targetRoleName) {
    await interaction.reply({
      content:
        `⚠️ ${targetUser} doesn't have any of the roles that trigger auto-verification ` +
        `(Findomme, Male + Findomme, or one of: ${verifyManager.SUB_TRIGGER_ROLES.join(', ')}).`,
      ephemeral: true,
    });
    return;
  }

  const targetRole = findRoleByName(guild, targetRoleName);
  if (!targetRole) {
    await interaction.reply({
      content: `⚠️ The role "${targetRoleName}" doesn't exist on this server yet. Create it first, then run this command again.`,
      ephemeral: true,
    });
    return;
  }

  const botMember = guild.members.me;
  if (!botMember || botMember.roles.highest.position <= targetRole.position) {
    await interaction.reply({
      content: `⚠️ I can't assign ${targetRole}: my role needs to be moved higher in the server's role list.`,
      ephemeral: true,
    });
    return;
  }

  // Keep the three "Verified" roles mutually exclusive: drop the other two (if present)
  // before adding the correct one, so re-running this command also fixes stale roles.
  const otherVerifiedNames = [
    verifyManager.ROLE_NAMES.verifiedFindomme,
    verifyManager.ROLE_NAMES.verifiedMaledomme,
    verifyManager.ROLE_NAMES.verifiedSub,
  ].filter((name) => name.toLowerCase() !== targetRoleName.toLowerCase());

  for (const name of otherVerifiedNames) {
    const role = findRoleByName(guild, name);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
    }
  }

  let alreadyHadIt = member.roles.cache.has(targetRole.id);
  if (!alreadyHadIt) {
    await member.roles.add(targetRole);
  }

  // Once someone is verified as Findom or Maledomme, the plain "Findomme" role is no
  // longer needed — remove it so it doesn't linger alongside the Verified role.
  let findommeRemoved = false;
  const isFindomOutcome =
    targetRoleName === verifyManager.ROLE_NAMES.verifiedFindomme ||
    targetRoleName === verifyManager.ROLE_NAMES.verifiedMaledomme;

  if (isFindomOutcome) {
    const findommeRole = findRoleByName(guild, verifyManager.ROLE_NAMES.findomme);
    if (findommeRole && member.roles.cache.has(findommeRole.id)) {
      if (botMember.roles.highest.position > findommeRole.position) {
        await member.roles.remove(findommeRole);
        findommeRemoved = true;
      } else {
        await interaction.reply({
          content:
            `⚠️ ${targetRole} assigned, but I couldn't remove the "Findomme" role: ` +
            `my role needs to be moved higher in the server's role list.`,
          ephemeral: true,
        });
        return;
      }
    }
  }

  const removedNote = findommeRemoved ? ' The "Findomme" role was removed.' : '';

  await interaction.reply({
    content: alreadyHadIt
      ? `✅ ${targetUser} already had ${targetRole} (no change needed).${removedNote}`
      : `✅ ${targetUser} verified: assigned ${targetRole}.${removedNote}`,
    ephemeral: true,
  });
}

module.exports = { handleCheck };
