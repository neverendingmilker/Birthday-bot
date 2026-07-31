const repo = require('./verifyRepository');

class ValidationError extends Error {}

const TYPES = ['findom', 'sub'];

// Name of the role that /verify check syncs with any target role from a combo rule:
// added when the member gains one, removed once they hold none.
const ROLE_NAMES = {
  ageVerified: 'Age verified',
};

async function getGuildConfig(guildId) {
  return repo.getGuildConfig(guildId);
}

async function setFindomRole(guildId, roleId) {
  await repo.setFindomRole(guildId, roleId);
}

async function setSubRole(guildId, roleId) {
  await repo.setSubRole(guildId, roleId);
}

async function setVerifiedChannel(guildId, channelId) {
  await repo.setVerifiedChannel(guildId, channelId);
}

// --- Combo rules ("if a member has ALL of these roles, give them this role") ---
// Matched by role ID, not by name — immune to emoji/whitespace/text differences in
// role names. This is the sole rule engine behind /verify check.

async function addComboRule(guildId, targetRoleId, triggerRoleIds, removeRoleId) {
  if (!targetRoleId) {
    throw new ValidationError('A target role is required.');
  }
  const uniqueTriggers = [...new Set((triggerRoleIds || []).filter(Boolean))];
  if (uniqueTriggers.length === 0) {
    throw new ValidationError('At least one trigger role is required.');
  }
  if (uniqueTriggers.includes(targetRoleId)) {
    throw new ValidationError('The target role cannot also be one of the trigger roles.');
  }
  if (removeRoleId && removeRoleId === targetRoleId) {
    throw new ValidationError('The role to remove cannot be the same as the target role.');
  }
  await repo.addComboRule(guildId, targetRoleId, uniqueTriggers, removeRoleId || null);
}

async function listComboRules(guildId) {
  return repo.listComboRules(guildId);
}

async function deleteComboRule(guildId, id) {
  const existing = await repo.getComboRule(guildId, id);
  if (!existing) {
    throw new ValidationError('No combo rule found with that ID in this server. Check `/verify comboroles list`.');
  }
  await repo.deleteComboRule(guildId, id);
  return existing;
}

// Given the configured combo rules and the role IDs a member currently holds, picks the
// best-matching rule (all of its trigger roles present), preferring the rule that requires
// the most trigger roles (most specific wins) when several match. Returns null if none match.
function determineComboRule(rules, memberRoleIds) {
  const roleIdSet = new Set(memberRoleIds);
  const matching = rules.filter((rule) => rule.trigger_role_ids.every((id) => roleIdSet.has(id)));
  if (matching.length === 0) return null;

  return matching.reduce((best, rule) =>
    rule.trigger_role_ids.length > best.trigger_role_ids.length ? rule : best
  );
}

// --- Role categories ("Dom" / "Sub") ---
// Purely a gate for /verify check: if a member holds none of the roles configured under
// either category, the combo rules can't tell what they are, so we ask an admin instead
// of guessing or refusing outright.

const CATEGORIES = ['dom', 'sub'];

async function addCategoryRole(guildId, category, roleId) {
  if (!CATEGORIES.includes(category)) {
    throw new ValidationError('Category must be "dom" or "sub".');
  }
  if (!roleId) {
    throw new ValidationError('A role is required.');
  }
  await repo.addCategoryRole(guildId, category, roleId);
}

async function removeCategoryRole(guildId, category, roleId) {
  if (!CATEGORIES.includes(category)) {
    throw new ValidationError('Category must be "dom" or "sub".');
  }
  await repo.removeCategoryRole(guildId, category, roleId);
}

// Returns { dom: [roleId, ...], sub: [roleId, ...] }.
async function listCategoryRoles(guildId) {
  const rows = await repo.listCategoryRoles(guildId);
  const grouped = { dom: [], sub: [] };
  for (const row of rows) {
    if (grouped[row.category]) grouped[row.category].push(row.role_id);
  }
  return grouped;
}

// True if the member holds at least one role configured under either category.
function hasAnyCategoryRole(memberRoleIds, categoryRoles) {
  const allCategoryIds = new Set([...categoryRoles.dom, ...categoryRoles.sub]);
  return memberRoleIds.some((id) => allCategoryIds.has(id));
}

// Records (or overwrites, if the user is re-verified) a verification entry.
async function recordVerification(guildId, userId, type, socialInput, methodInput, verifiedBy, channelId, messageId) {
  if (!TYPES.includes(type)) {
    throw new ValidationError('Invalid verification type.');
  }
  if (!methodInput || !methodInput.trim()) {
    throw new ValidationError('Method is required.');
  }

  const social = socialInput && socialInput.trim() ? socialInput.trim() : null;
  const method = methodInput.trim();

  await repo.upsertVerification(guildId, userId, type, social, method, Date.now(), verifiedBy, channelId, messageId);

  return { social, method };
}

async function getVerification(guildId, userId, type) {
  return repo.getVerification(guildId, userId, type);
}

// Edits an existing verification's Social and/or Method. At least one must be provided
// (pass `undefined` for a field that shouldn't change).
async function editVerification(guildId, userId, type, socialInput, methodInput) {
  if (socialInput === undefined && methodInput === undefined) {
    throw new ValidationError('Provide at least a new Social or Method value to change.');
  }
  if (methodInput !== undefined && !methodInput.trim()) {
    throw new ValidationError('Method cannot be empty.');
  }

  const existing = await repo.getVerification(guildId, userId, type);
  if (!existing) {
    throw new ValidationError('No existing verification found for that user and type.');
  }

  const newSocial =
    socialInput !== undefined ? (socialInput.trim() ? socialInput.trim() : null) : existing.social;
  const newMethod = methodInput !== undefined ? methodInput.trim() : existing.method;

  await repo.updateVerificationFields(guildId, userId, type, newSocial, newMethod);

  return { ...existing, social: newSocial, method: newMethod };
}

module.exports = {
  ValidationError,
  ROLE_NAMES,
  getGuildConfig,
  setFindomRole,
  setSubRole,
  setVerifiedChannel,
  addComboRule,
  listComboRules,
  deleteComboRule,
  determineComboRule,
  addCategoryRole,
  removeCategoryRole,
  listCategoryRoles,
  hasAnyCategoryRole,
  recordVerification,
  getVerification,
  editVerification,
};
