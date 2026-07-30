const repo = require('./verifyRepository');

class ValidationError extends Error {}

const TYPES = ['findom', 'sub'];

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
  getGuildConfig,
  setFindomRole,
  setSubRole,
  setVerifiedChannel,
  recordVerification,
  getVerification,
  editVerification,
};
