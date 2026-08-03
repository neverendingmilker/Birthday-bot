// Feature "comboroles": nessuna persistenza, solo calcolo in memoria a partire
// dai membri della gilda già in cache/fetch. Tenuta separata dal command
// handler per restare coerente con l'architettura a feature indipendenti.

// Restituisce i GuildMember che possiedono TUTTI i ruoli in roleIds e NESSUNO
// dei ruoli in excludeRoleIds (BUT).
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
