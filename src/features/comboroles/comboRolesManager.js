// \"comboroles\" feature: no persistence, just in-memory computation over the
// guild's members. Kept separate from the command handler to stay consistent
// with the independent-features architecture.

const repo = require('./comboRolesRepository');

async function isEnabled(guildId) {
  return repo.isEnabled(guildId);
}

async function setEnabled(guildId, enabled) {
  await repo.setEnabled(guildId, enabled);
}

// Returns the GuildMembers who have ALL the roles in roleIds and NONE of the
// roles in excludeRoleIds (BUT).
async function findMembersWithRoles(guild, roleIds, excludeRoleIds = []) {
  // The member cache is warmed once at startup (see memberCacheWarmer.js) and
  // kept up to date live via the GuildMembers intent, so normally this reads
  // straight from cache without hitting the gateway again. Fallback to a
  // real fetch only for the rare case the cache is still empty (e.g. right
  // after a cold start, before the warm-up has completed).
  const members = guild.members.cache.size > 0 ? guild.members.cache : await guild.members.fetch();

  return members.filter((member) => {
    const hasAllRequired = roleIds.every((roleId) => member.roles.cache.has(roleId));
    if (!hasAllRequired) return false;

    const hasAnyExcluded = excludeRoleIds.some((roleId) => member.roles.cache.has(roleId));
    return !hasAnyExcluded;
  });
}

module.exports = { findMembersWithRoles, isEnabled, setEnabled };
