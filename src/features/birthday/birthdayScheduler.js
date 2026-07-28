const cron = require('node-cron');
const config = require('../../config/config');
const repo = require('./birthdayRepository');

const MS_PER_HOUR = 60 * 60 * 1000;

function isToday(day, month, today = new Date()) {
  return day === today.getDate() && month === today.getMonth() + 1;
}

// Assigns the birthday role to a single user if today is their birthday and it hasn't
// been assigned yet this year. Reusable both by the daily scheduler and by the slash
// commands directly, so the role is assigned right away instead of waiting for next
// year's cron run when today's midnight check has already passed.
async function assignBirthdayRoleIfDue(client, guildId, userId, day, month) {
  if (!isToday(day, month)) return { assigned: false, reason: 'not_today' };

  const year = new Date().getFullYear();
  if (await repo.hasAssignmentThisYear(guildId, userId, year)) {
    return { assigned: false, reason: 'already_assigned' };
  }

  const guildConfig = await repo.getGuildConfig(guildId);
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

// Sweeps every birthday matching today's day/month, across all guilds the bot is in.
async function assignAllDueToday(client) {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;

  const celebrating = await repo.getBirthdaysForToday(day, month);

  for (const { guild_id: guildId, user_id: userId } of celebrating) {
    try {
      const result = await assignBirthdayRoleIfDue(client, guildId, userId, day, month);
      if (result.assigned) {
        console.log(`[birthday] Assigned the role to ${userId} in guild ${guildId}`);
      } else if (result.reason === 'role_too_high') {
        console.warn(
          `[birthday] Could not assign the role to ${userId} in guild ${guildId}: the bot's role is not high enough in the hierarchy.`
        );
      }
    } catch (err) {
      console.error(`[birthday] Error assigning the role to ${userId} (${guildId}):`, err);
    }
  }
}

// Same as assignAllDueToday, but scoped to a single guild. Used right after an admin
// configures the birthday role, in case someone's birthday is already today.
async function assignDueTodayForGuild(client, guildId) {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;

  const celebrating = (await repo.getBirthdaysForToday(day, month)).filter(
    (row) => row.guild_id === guildId
  );

  const results = [];
  for (const { user_id: userId } of celebrating) {
    const result = await assignBirthdayRoleIfDue(client, guildId, userId, day, month);
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
      const expiryMs = guildConfig.remove_after_hours * MS_PER_HOUR;

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
  // Every day at midnight, in the configured timezone: assign the role to today's birthdays
  cron.schedule('0 0 * * *', () => assignAllDueToday(client), {
    timezone: config.timezone,
  });

  // Every 5 minutes: check whether any role assignment has expired
  cron.schedule('*/5 * * * *', () => removeExpiredRoles(client), {
    timezone: config.timezone,
  });

  // Also run once at startup, useful if the bot was offline at midnight
  assignAllDueToday(client);
  removeExpiredRoles(client);

  console.log('[birthday] Scheduler started.');
}

module.exports = { start, assignBirthdayRoleIfDue, assignAllDueToday, assignDueTodayForGuild };
