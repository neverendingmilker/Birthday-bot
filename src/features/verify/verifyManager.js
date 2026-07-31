const repo = require('./verifyRepository');

class ValidationError extends Error {}

const TYPES = ['sub', 'domme', 'maledom'];

const TYPE_LABELS = {
  sub: 'Sub',
  domme: 'Domme',
  maledom: 'Maledom',
};

// Embed side-bar color used in the verification report, per type.
const TYPE_COLORS = {
  sub: 0x2ecc71, // green
  domme: 0xe74c3c, // red
  maledom: 0x3498db, // blue
};

async function getGuildConfig(guildId) {
  return repo.getGuildConfig(guildId);
}

// Updates any combination of settings in one call: the give/remove roles for the
// three verification types, and/or the report channel. `updates` keys (all optional,
// pass only the ones that changed): subGive, subRemove, dommeGive, dommeRemove,
// maledomGive, maledomRemove (role ID strings), channel (channel ID string).
async function setConfig(guildId, updates) {
  const current = await repo.getGuildConfig(guildId);

  const merged = {
    sub_give_role_id: updates.subGive !== undefined ? updates.subGive : current.sub_give_role_id,
    sub_remove_role_id: updates.subRemove !== undefined ? updates.subRemove : current.sub_remove_role_id,
    domme_give_role_id: updates.dommeGive !== undefined ? updates.dommeGive : current.domme_give_role_id,
    domme_remove_role_id:
      updates.dommeRemove !== undefined ? updates.dommeRemove : current.domme_remove_role_id,
    maledom_give_role_id:
      updates.maledomGive !== undefined ? updates.maledomGive : current.maledom_give_role_id,
    maledom_remove_role_id:
      updates.maledomRemove !== undefined ? updates.maledomRemove : current.maledom_remove_role_id,
    report_channel_id: updates.channel !== undefined ? updates.channel : current.report_channel_id,
  };

  await repo.setGuildConfig(guildId, merged);
  return merged;
}

// Returns { giveRoleId, removeRoleId } for a verification type, reading from the
// guild's config object (as returned by getGuildConfig).
function getRoleIdsForType(config, type) {
  if (!TYPES.includes(type)) {
    throw new ValidationError(`Unknown verification type "${type}".`);
  }
  return {
    giveRoleId: config[`${type}_give_role_id`],
    removeRoleId: config[`${type}_remove_role_id`],
  };
}

module.exports = {
  ValidationError,
  TYPES,
  TYPE_LABELS,
  TYPE_COLORS,
  getGuildConfig,
  setConfig,
  getRoleIdsForType,
};
