// "comboroles" feature: no persistence, just in-memory computation over the
// guild's members (fetched on demand). Kept separate from the command
// handler to stay consistent with the independent-features architecture.

// Returns the GuildMembers who have ALL the roles in roleIds and NONE of the
// roles in excludeRoleIds (BUT).
async function findMembersWithRoles(guild, roleIds, excludeRoleIds = []) {
  const members = await guild.members.fetch();

  return members.filter((member) => {
    const hasAllRequired = roleIds.every((roleId) => member.roles.cache.has(roleId));
    if (!hasAllRequired) return false;

    const hasAnyExcluded = excludeRoleIds.some((roleId) => member.roles.cache.has(roleId));
    return !hasAnyExcluded;
  });
}

module.exports = { findMembersWithRoles };
