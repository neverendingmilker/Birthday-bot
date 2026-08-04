const { AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const repo = require('./incidentRepository');
const { generateImage } = require('./incidentImage');

const MAX_COUNT = 100000; // sanity cap against typos, not a real-world limit

class ValidationError extends Error {}

function validateCount(count) {
  if (!Number.isInteger(count)) {
    throw new ValidationError('The number must be a whole number.');
  }
  if (count < 0) {
    throw new ValidationError('The number cannot be negative.');
  }
  if (count > MAX_COUNT) {
    throw new ValidationError(`The number cannot be greater than ${MAX_COUNT}.`);
  }
}

async function getGuildConfig(guildId) {
  return repo.getGuildConfig(guildId);
}

async function setChannel(guildId, channelId) {
  await repo.setChannel(guildId, channelId);
}

// Regenerates the sign for the current count and posts it in the configured
// channel, deleting the previous post first — only one sign is ever visible at
// a time, same as the original bot.
async function postUpdate(client, guildId) {
  const guildConfig = await repo.getGuildConfig(guildId);
  if (!guildConfig.channel_id) return { posted: false, reason: 'no_channel_configured' };

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { posted: false, reason: 'guild_not_found' };

  const channel = guild.channels.cache.get(guildConfig.channel_id);
  if (!channel) return { posted: false, reason: 'channel_not_found' };

  const botMember = guild.members.me;
  const canPost =
    botMember &&
    channel
      .permissionsFor(botMember)
      ?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]);
  if (!canPost) return { posted: false, reason: 'missing_permission' };

  if (guildConfig.last_message_id) {
    const oldMessage = await channel.messages.fetch(guildConfig.last_message_id).catch(() => null);
    if (oldMessage) await oldMessage.delete().catch(() => null);
  }

  const buffer = await generateImage(guildConfig.count);
  const attachment = new AttachmentBuilder(buffer, { name: 'incident.png' });
  const newMessage = await channel.send({ files: [attachment] });

  await repo.setLastMessageId(guildId, newMessage.id);

  return { posted: true };
}

// Sets an explicit value (used by /incident setnumber) and immediately refreshes
// the posted sign.
async function setCount(client, guildId, count) {
  validateCount(count);
  await repo.setCount(guildId, count);
  return postUpdate(client, guildId);
}

// Resets to 0 (used by /incident reset, i.e. "an incident just happened").
async function reset(client, guildId) {
  return setCount(client, guildId, 0);
}

// Adds one day to every guild that has a channel configured, and refreshes
// their sign. Used by the daily scheduler.
async function incrementAllDue(client) {
  const guilds = await repo.getAllConfiguredGuilds();

  for (const row of guilds) {
    try {
      const newCount = Number(row.count ?? 0) + 1;
      await repo.setCount(row.guild_id, newCount);
      const result = await postUpdate(client, row.guild_id);
      if (result.posted) {
        console.log(`[incident] Incremented to ${newCount} and updated the sign in guild ${row.guild_id}`);
      } else {
        console.warn(`[incident] Incremented to ${newCount} in guild ${row.guild_id} but could not post: ${result.reason}`);
      }
    } catch (err) {
      console.error(`[incident] Error incrementing the counter for guild ${row.guild_id}:`, err);
    }
  }
}

module.exports = {
  ValidationError,
  getGuildConfig,
  setChannel,
  postUpdate,
  setCount,
  reset,
  incrementAllDue,
};
