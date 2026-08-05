const repo = require('./boosterLinkRepository');

class ValidationError extends Error {}

// Members with this role are never touched by the auto-removal, even if they
// have linked custom roles and stop boosting (e.g. staff/VIP who keep perks
// regardless of boost status).
const IGNORED_ROLE_ID = '1090658915810820156';

async function isEnabled(guildId) {
  return repo.isEnabled(guildId);
}

async function setEnabled(guildId, enabled) {
  await repo.setEnabled(guildId, enabled);
}

// Links a custom perk role to a booster. Requires the bot's own top role to sit
// above the linked role, otherwise it wouldn't be able to remove it later.
async function link(guild, userId, role, createdBy) {
  const botMember = guild.members.me;
  if (!botMember || botMember.roles.highest.position <= role.position) {
    throw new ValidationError(
      `My role needs to be higher than ${role} in the role list for me to be able to remove it later. Move my role above it in Server Settings → Roles and try again.`
    );
  }

  await repo.addLink(guild.id, userId, role.id, createdBy);
}

// Unlinks a specific role for a user, or every role linked to them if `roleId`
// is omitted. Returns how many links were removed (only meaningful for the
// "all" case, where the caller wants to know if anything was actually there).
async function unlink(guildId, userId, roleId) {
  if (roleId) {
    await repo.removeLink(guildId, userId, roleId);
    return 1;
  }
  return repo.removeAllLinksForUser(guildId, userId);
}

async function listForUser(guildId, userId) {
  return repo.getLinksForUser(guildId, userId);
}

async function listAll(guildId) {
  return repo.getAllLinksInGuild(guildId);
}

// Called from guildMemberUpdate: if the member just lost the server's Booster
// role, remove every custom role linked to them and stop tracking those links —
// the perk no longer applies once they stop boosting.
async function handleMemberUpdate(oldMember, newMember) {
  if (!(await repo.isEnabled(newMember.guild.id))) return; // feature disabled for this guild

  const hadBooster = oldMember.roles.premiumSubscriberRole !== null;
  const hasBooster = newMember.roles.premiumSubscriberRole !== null;
  if (!hadBooster || hasBooster) return; // wasn't a booster before, or still is one

  if (newMember.roles.cache.has(IGNORED_ROLE_ID)) return; // exempt from auto-removal regardless of boost status

  const links = await repo.getLinksForUser(newMember.guild.id, newMember.id);
  if (links.length === 0) return;

  for (const linkRow of links) {
    try {
      if (newMember.roles.cache.has(linkRow.role_id)) {
        await newMember.roles.remove(linkRow.role_id).catch((err) => {
          console.warn(
            `[boosterlinks] Could not remove role ${linkRow.role_id} from ${newMember.id} in guild ${newMember.guild.id}:`,
            err.message
          );
        });
      }
      await repo.removeLink(linkRow.guild_id, linkRow.user_id, linkRow.role_id);
      console.log(
        `[boosterlinks] ${newMember.id} stopped boosting guild ${newMember.guild.id}; removed and untracked role ${linkRow.role_id}.`
      );
    } catch (err) {
      console.error(`[boosterlinks] Error handling custom-role cleanup for ${newMember.id}:`, err);
    }
  }
}

module.exports = {
  ValidationError,
  isEnabled,
  setEnabled,
  link,
  unlink,
  listForUser,
  listAll,
  handleMemberUpdate,
};
