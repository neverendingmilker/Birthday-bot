const db = require('../../database/db');

// --- Guild config (which roles to assign, where to post reports) ---

async function getGuildConfig(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM verify_guild_config WHERE guild_id = ?',
    args: [guildId],
  });

  const row = result.rows[0];
  return row
    ? {
        guild_id: row.guild_id,
        findom_role_id: row.findom_role_id,
        sub_role_id: row.sub_role_id,
        maledomme_role_id: row.maledomme_role_id,
        verified_channel_id: row.verified_channel_id,
      }
    : {
        guild_id: guildId,
        findom_role_id: null,
        sub_role_id: null,
        maledomme_role_id: null,
        verified_channel_id: null,
      };
}

async function setFindomRole(guildId, roleId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO verify_guild_config (guild_id, findom_role_id, sub_role_id, maledomme_role_id, verified_channel_id)
          VALUES (?, ?, NULL, NULL, NULL)
          ON CONFLICT(guild_id) DO UPDATE SET findom_role_id = excluded.findom_role_id`,
    args: [guildId, roleId],
  });
}

async function setSubRole(guildId, roleId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO verify_guild_config (guild_id, findom_role_id, sub_role_id, maledomme_role_id, verified_channel_id)
          VALUES (?, NULL, ?, NULL, NULL)
          ON CONFLICT(guild_id) DO UPDATE SET sub_role_id = excluded.sub_role_id`,
    args: [guildId, roleId],
  });
}

async function setMaledommeRole(guildId, roleId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO verify_guild_config (guild_id, findom_role_id, sub_role_id, maledomme_role_id, verified_channel_id)
          VALUES (?, NULL, NULL, ?, NULL)
          ON CONFLICT(guild_id) DO UPDATE SET maledomme_role_id = excluded.maledomme_role_id`,
    args: [guildId, roleId],
  });
}

async function setVerifiedChannel(guildId, channelId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO verify_guild_config (guild_id, findom_role_id, sub_role_id, maledomme_role_id, verified_channel_id)
          VALUES (?, NULL, NULL, NULL, ?)
          ON CONFLICT(guild_id) DO UPDATE SET verified_channel_id = excluded.verified_channel_id`,
    args: [guildId, channelId],
  });
}

// --- Verification records (one per guild + user + type) ---

async function upsertVerification(guildId, userId, type, social, method, verifiedAt, verifiedBy, channelId, messageId) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO verify_entries
            (guild_id, user_id, type, social, method, verified_at, verified_by, channel_id, message_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(guild_id, user_id, type) DO UPDATE SET
            social = excluded.social,
            method = excluded.method,
            verified_at = excluded.verified_at,
            verified_by = excluded.verified_by,
            channel_id = excluded.channel_id,
            message_id = excluded.message_id`,
    args: [guildId, userId, type, social, method, verifiedAt, verifiedBy, channelId, messageId],
  });
}

async function getVerification(guildId, userId, type) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM verify_entries WHERE guild_id = ? AND user_id = ? AND type = ?',
    args: [guildId, userId, type],
  });
  return result.rows[0] || null;
}

async function updateVerificationFields(guildId, userId, type, social, method) {
  await db.ready;
  await db.client.execute({
    sql: 'UPDATE verify_entries SET social = ?, method = ? WHERE guild_id = ? AND user_id = ? AND type = ?',
    args: [social, method, guildId, userId, type],
  });
}

module.exports = {
  getGuildConfig,
  setFindomRole,
  setSubRole,
  setMaledommeRole,
  setVerifiedChannel,
  upsertVerification,
  getVerification,
  updateVerificationFields,
};
