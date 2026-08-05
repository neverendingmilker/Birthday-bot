const repo = require('./roleLinkRepository');

class ValidationError extends Error {}

async function isEnabled(guildId) {
  return repo.isEnabled(guildId);
}

async function setEnabled(guildId, enabled) {
  await repo.setEnabled(guildId, enabled);
}

// The bot must be able to remove either role depending on direction (role2 is
// always a candidate; role1 too when bidirectional is set), so its own top role
// needs to sit above both.
function assertCanManageBothRoles(guild, roleA, roleB) {
  const botMember = guild.members.me;
  const botTop = botMember?.roles.highest;
  if (!botTop || botTop.position <= roleA.position || botTop.position <= roleB.position) {
    throw new ValidationError(
      `My role needs to be higher than both ${roleA} and ${roleB} in the role list for me to be able to remove them. Move my role above them in Server Settings → Roles and try again.`
    );
  }
}

async function link(guild, roleA, roleB, bidirectional, createdBy) {
  if (roleA.id === roleB.id) {
    throw new ValidationError("Role 1 and Role 2 can't be the same role.");
  }
  assertCanManageBothRoles(guild, roleA, roleB);
  await repo.addLink(guild.id, roleA.id, roleB.id, bidirectional, createdBy);
}

async function unlink(guildId, roleAId, roleBId) {
  return repo.removeLink(guildId, roleAId, roleBId);
}

async function listAll(guildId) {
  return repo.getAllLinksInGuild(guildId);
}

// Called from guildMemberUpdate: for every role the member just lost, checks
// every configured pair and removes the linked counterpart role if they still
// have it — role_a lost removes role_b always, role_b lost removes role_a only
// when the pair is marked bidirectional ("viceversa").
async function handleMemberUpdate(oldMember, newMember) {
  if (!(await repo.isEnabled(newMember.guild.id))) return; // feature disabled for this guild

  const removedRoleIds = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id)).map((r) => r.id);
  if (removedRoleIds.length === 0) return;

  const links = await repo.getAllLinksInGuild(newMember.guild.id);
  if (links.length === 0) return;

  for (const removedRoleId of removedRoleIds) {
    for (const linkRow of links) {
      let roleToRemove = null;
      if (linkRow.role_a_id === removedRoleId) {
        roleToRemove = linkRow.role_b_id;
      } else if (linkRow.bidirectional && linkRow.role_b_id === removedRoleId) {
        roleToRemove = linkRow.role_a_id;
      }

      if (!roleToRemove || !newMember.roles.cache.has(roleToRemove)) continue;

      try {
        await newMember.roles.remove(roleToRemove);
        console.log(
          `[rolelinks] ${newMember.id} lost role ${removedRoleId} in guild ${newMember.guild.id}; removed linked role ${roleToRemove}.`
        );
      } catch (err) {
        console.warn(
          `[rolelinks] Could not remove linked role ${roleToRemove} from ${newMember.id} in guild ${newMember.guild.id}:`,
          err.message
        );
      }
    }
  }
}

module.exports = {
  ValidationError,
  isEnabled,
  setEnabled,
  link,
  unlink,
  listAll,
  handleMemberUpdate,
};
