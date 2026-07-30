const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

// Looks up a role on the guild by name, case-insensitively.
function findRoleByName(guild, name) {
  return guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

// Resolves one of the three "Verified" roles: the Maledomme one can be configured
// via `/verify roles maledomme:<role>` (guildConfig.maledomme_role_id) — if set, that
// takes priority; otherwise (and for the other two) fall back to matching by name.
function resolveVerifiedRole(guild, roleName, guildConfig) {
  if (roleName === verifyManager.ROLE_NAMES.verifiedMaledomme && guildConfig.maledomme_role_id) {
    const configured = guild.roles.cache.get(guildConfig.maledomme_role_id);
    if (configured) return configured;
  }
  return findRoleByName(guild, roleName);
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

  const guildConfig = await verifyManager.getGuildConfig(interaction.guildId);

  const memberRoleNames = member.roles.cache.map((r) => r.name);
  const targetRoleName = verifyManager.determineVerifiedRoleName(memberRoleNames);

  if (!targetRoleName) {
    await interaction.reply({
      content:
        `⚠️ ${targetUser} doesn't have any of the roles that trigger auto-verification ` +
        `(Findomme, Male + Findomme, or one of: ${verifyManager.SUB_TRIGGER_ROLES.join(', ')}).\n` +
        `Their current roles: ${memberRoleNames.length ? memberRoleNames.map((n) => `\`${n}\``).join(', ') : '(none)'}`,
      ephemeral: true,
    });
    return;
  }

  const targetRole = resolveVerifiedRole(guild, targetRoleName, guildConfig);
  if (!targetRole) {
    await interaction.reply({
      content: `⚠️ The role "${targetRoleName}" doesn't exist on this server yet. Create it (or set it with \`/verify roles\`), then run this command again.`,
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
  const otherVerifiedNames = verifyManager.VERIFIED_ROLE_NAMES.filter(
    (name) => name.toLowerCase() !== targetRoleName.toLowerCase()
  );

  for (const name of otherVerifiedNames) {
    const role = resolveVerifiedRole(guild, name, guildConfig);
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

  // "Age verified" tracks whether the member holds any of the three Verified roles:
  // add it when they gain one, remove it once they hold none of them.
  let ageVerifiedNote = '';
  const ageRole = findRoleByName(guild, verifyManager.ROLE_NAMES.ageVerified);
  if (ageRole) {
    const hasAnyVerifiedRole = verifyManager.VERIFIED_ROLE_NAMES.some((name) => {
      const role = resolveVerifiedRole(guild, name, guildConfig);
      return role && member.roles.cache.has(role.id);
    });

    if (botMember.roles.highest.position > ageRole.position) {
      if (hasAnyVerifiedRole && !member.roles.cache.has(ageRole.id)) {
        await member.roles.add(ageRole);
        ageVerifiedNote = ' "Age verified" was added.';
      } else if (!hasAnyVerifiedRole && member.roles.cache.has(ageRole.id)) {
        await member.roles.remove(ageRole);
        ageVerifiedNote = ' "Age verified" was removed.';
      }
    } else if (hasAnyVerifiedRole && !member.roles.cache.has(ageRole.id)) {
      ageVerifiedNote = ' ⚠️ Couldn\'t add "Age verified": my role needs to be moved higher in the role list.';
    }
  }

  await interaction.reply({
    content: alreadyHadIt
      ? `✅ ${targetUser} already had ${targetRole} (no change needed).${removedNote}${ageVerifiedNote}`
      : `✅ ${targetUser} verified: assigned ${targetRole}.${removedNote}${ageVerifiedNote}`,
    ephemeral: true,
  });
}

module.exports = { handleCheck };
