const cron = require('node-cron');
const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config');
const repo = require('./birthdayRepository');

const MS_PER_SECOND = 1000;

function isToday(day, month, today = new Date()) {
  return day === today.getDate() && month === today.getMonth() + 1;
}

// Assigns the birthday role to a single user, if a role is configured and it
// hasn't already been assigned to them this year.
async function tryAssignRole(client, guildId, userId, year, guildConfig) {
  if (await repo.hasAssignmentThisYear(guildId, userId, year)) {
    return { assigned: false, reason: 'already_assigned' };
  }
  if (!guildConfig.birthday_role_id) {
    return { assigned: false, reason: 'no_role_configured' };
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { assigned: false, reason: 'guild_not_found' };

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return { assigned: false, reason: 'member_not_found' };

  const role = guild.roles.cache.get(guildConfig.birthday_role_id);
  if (!role) return { assigned: false, reason: 'role_not_found' };

  const botMember = guild.members.me;
  if (!botMember || botMember.roles.highest.position <= role.position) {
    return { assigned: false, reason: 'role_too_high' };
  }

  await member.roles.add(role);
  await repo.recordRoleAssignment(guildId, userId, Date.now(), year);
  return { assigned: true };
}

// Posts a birthday greeting in the configured channel, if one is set and the
// user hasn't already been greeted this year.
async function trySendGreeting(client, guildId, userId, year, guildConfig) {
  if (await repo.hasGreetedThisYear(guildId, userId, year)) {
    return { sent: false, reason: 'already_greeted' };
  }
  if (!guildConfig.birthday_channel_id) {
    return { sent: false, reason: 'no_channel_configured' };
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { sent: false, reason: 'guild_not_found' };

  const channel = guild.channels.cache.get(guildConfig.birthday_channel_id);
  if (!channel) return { sent: false, reason: 'channel_not_found' };

  const botMember = guild.members.me;
  const canSend = botMember && channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages);
  if (!canSend) return { sent: false, reason: 'missing_permission' };

  await channel.send(`🎉🎂 Happy birthday, <@${userId}>! Have an amazing day! 🎂🎉`);
  await repo.recordGreeting(guildId, userId, year);
  return { sent: true };
}

// Combined check for a single user: assigns the role AND sends the greeting,
// independently of one another (a server can use either, both, or neither).
// Reusable both by the daily scheduler and by the slash commands directly, so
// things happen right away instead of waiting for next year's cron run when
// today's midnight check has already passed.
async function celebrateBirthdayIfDue(client, guildId, userId, day, month) {
  if (!isToday(day, month)) return { isToday: false };

  const year = new Date().getFullYear();
  const guildConfig = await repo.getGuildConfig(guildId);

  const roleResult = await tryAssignRole(client, guildId, userId, year, guildConfig);
  const greetingResult = await trySendGreeting(client, guildId, userId, year, guildConfig);

  return { isToday: true, roleResult, greetingResult };
}

// Sweeps every birthday matching today's day/month, across all guilds the bot is in.
async function celebrateAllDueToday(client) {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;

  const celebrating = await repo.getBirthdaysForToday(day, month);

  for (const { guild_id: guildId, user_id: userId } of celebrating) {
    try {
      const result = await celebrateBirthdayIfDue(client, guildId, userId, day, month);
      if (result.roleResult?.assigned) {
        console.log(`[birthday] Assigned the role to ${userId} in guild ${guildId}`);
      } else if (result.roleResult?.reason === 'role_too_high') {
        console.warn(
          `[birthday] Could not assign the role to ${userId} in guild ${guildId}: the bot's role is not high enough in the hierarchy.`
        );
      }
      if (result.greetingResult?.sent) {
        console.log(`[birthday] Sent a greeting for ${userId} in guild ${guildId}`);
      }
    } catch (err) {
      console.error(`[birthday] Error celebrating the birthday of ${userId} (${guildId}):`, err);
    }
  }
}

// Same as celebrateAllDueToday, but scoped to a single guild. Used right after an
// admin configures the birthday role or the greeting channel, in case someone's
// birthday is already today.
async function celebrateDueTodayForGuild(client, guildId) {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;

  const celebrating = (await repo.getBirthdaysForToday(day, month)).filter(
    (row) => row.guild_id === guildId
  );

  const results = [];
  for (const { user_id: userId } of celebrating) {
    const result = await celebrateBirthdayIfDue(client, guildId, userId, day, month);
    results.push({ userId, ...result });
  }
  return results;
}

async function removeExpiredRoles(client) {
  const assignments = await repo.getAllActiveAssignments();
  const now = Date.now();

  for (const a of assignments) {
    try {
      const guildConfig = await repo.getGuildConfig(a.guild_id);
      const expiryMs = guildConfig.remove_after_seconds * MS_PER_SECOND;

      if (now - a.assigned_at < expiryMs) continue; // not due yet

      const guild = client.guilds.cache.get(a.guild_id);
      if (!guild) {
        await repo.removeRoleAssignment(a.guild_id, a.user_id);
        continue;
      }

      const member = await guild.members.fetch(a.user_id).catch(() => null);
      if (member && guildConfig.birthday_role_id) {
        await member.roles.remove(guildConfig.birthday_role_id).catch(() => null);
      }

      await repo.removeRoleAssignment(a.guild_id, a.user_id);
      console.log(`[birthday] Removed the role from ${a.user_id} in guild ${a.guild_id}`);
    } catch (err) {
      console.error(`[birthday] Error removing the role from ${a.user_id} (${a.guild_id}):`, err);
    }
  }
}

function start(client) {
  // Every day at midnight, in the configured timezone: celebrate today's birthdays
  cron.schedule('0 0 * * *', () => celebrateAllDueToday(client), {
    timezone: config.timezone,
  });

  // Every 10 seconds: check whether any role assignment has expired. This fine-grained
  // interval matches the minimum removal timer allowed (10 seconds) via /birthday removerole.
  cron.schedule('*/10 * * * * *', () => removeExpiredRoles(client), {
    timezone: config.timezone,
  });

  // Also run once at startup, useful if the bot was offline at midnight
  celebrateAllDueToday(client);
  removeExpiredRoles(client);

  console.log('[birthday] Scheduler started.');
}

module.exports = { start, celebrateBirthdayIfDue, celebrateAllDueToday, celebrateDueTodayForGuild };
