const repo = require('./verifyRepository');

class ValidationError extends Error {}

const TYPES = ['findom', 'sub'];

// --- Role-based auto-verification (used by /verify check) ---
// These are matched by role NAME (case-insensitive) against the roles the member
// already holds on the server, not stored in the DB.
const ROLE_NAMES = {
  findomme: 'Findomme',
  male: 'Male',
  verifiedFindomme: 'Verified Findomme',
  verifiedMaledomme: 'Verified Maledomme',
  verifiedSub: 'Verified sub',
  ageVerified: 'Age verified',
};

// The three "Verified" roles that /verify check can assign — used to know when
// "Age verified" should follow along (added when one of these is gained, removed
// when the member no longer holds any of them).
const VERIFIED_ROLE_NAMES = [ROLE_NAMES.verifiedFindomme, ROLE_NAMES.verifiedMaledomme, ROLE_NAMES.verifiedSub];

// Any one of these roles qualifies the member for "Verified sub".
const SUB_TRIGGER_ROLES = ['Finsub', 'RT Slave', 'Switch', 'Gaming slave', 'Lurker'];

// Given the list of role names a member currently holds, decides which "Verified"
// role name applies to them, or null if none of the rules match.
// Rules (checked in this order):
//   1. Has BOTH Findomme and Male       -> Verified Maledomme
//   2. Has Findomme (without Male)      -> Verified Findomme
//   3. Has any of SUB_TRIGGER_ROLES     -> Verified sub
function determineVerifiedRoleName(memberRoleNames) {
  const lowerNames = memberRoleNames.map((n) => n.trim().toLowerCase());
  const has = (name) => lowerNames.includes(name.trim().toLowerCase());

  const hasFindomme = has(ROLE_NAMES.findomme);
  const hasMale = has(ROLE_NAMES.male);
  const hasSubTrigger = SUB_TRIGGER_ROLES.some((name) => has(name));

  if (hasFindomme && hasMale) return ROLE_NAMES.verifiedMaledomme;
  if (hasFindomme) return ROLE_NAMES.verifiedFindomme;
  if (hasSubTrigger) return ROLE_NAMES.verifiedSub;
  return null;
}

async function getGuildConfig(guildId) {
  return repo.getGuildConfig(guildId);
}

async function setFindomRole(guildId, roleId) {
  await repo.setFindomRole(guildId, roleId);
}

async function setSubRole(guildId, roleId) {
  await repo.setSubRole(guildId, roleId);
}

async function setMaledommeRole(guildId, roleId) {
  await repo.setMaledommeRole(guildId, roleId);
}

async function setVerifiedChannel(guildId, channelId) {
  await repo.setVerifiedChannel(guildId, channelId);
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
  SUB_TRIGGER_ROLES,
  VERIFIED_ROLE_NAMES,
  determineVerifiedRoleName,
  getGuildConfig,
  setFindomRole,
  setSubRole,
  setMaledommeRole,
  setVerifiedChannel,
  recordVerification,
  getVerification,
  editVerification,
};
