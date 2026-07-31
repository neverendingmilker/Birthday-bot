const db = require('../../database/db');

// --- Guild config: which role to give / (optionally) remove for each verification
// type, plus the channel where verification reports get posted ---

async function getGuildConfig(guildId) {
  await db.ready;
  const result = await db.client.execute({
    sql: 'SELECT * FROM verify_role_config WHERE guild_id = ?',
    args: [guildId],
  });

  const row = result.rows[0];
  return row
    ? {
        guild_id: row.guild_id,
        sub_give_role_id: row.sub_give_role_id,
        sub_remove_role_id: row.sub_remove_role_id,
        domme_give_role_id: row.domme_give_role_id,
        domme_remove_role_id: row.domme_remove_role_id,
        maledom_give_role_id: row.maledom_give_role_id,
        maledom_remove_role_id: row.maledom_remove_role_id,
        report_channel_id: row.report_channel_id,
      }
    : {
        guild_id: guildId,
        sub_give_role_id: null,
        sub_remove_role_id: null,
        domme_give_role_id: null,
        domme_remove_role_id: null,
        maledom_give_role_id: null,
        maledom_remove_role_id: null,
        report_channel_id: null,
      };
}

// Always writes all 7 columns (the manager merges with the existing row first, so
// callers never need to worry about accidentally clearing a value that wasn't touched).
async function setGuildConfig(guildId, fields) {
  await db.ready;
  await db.client.execute({
    sql: `INSERT INTO verify_role_config
            (guild_id, sub_give_role_id, sub_remove_role_id, domme_give_role_id, domme_remove_role_id, maledom_give_role_id, maledom_remove_role_id, report_channel_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET
            sub_give_role_id = excluded.sub_give_role_id,
            sub_remove_role_id = excluded.sub_remove_role_id,
            domme_give_role_id = excluded.domme_give_role_id,
            domme_remove_role_id = excluded.domme_remove_role_id,
            maledom_give_role_id = excluded.maledom_give_role_id,
            maledom_remove_role_id = excluded.maledom_remove_role_id,
            report_channel_id = excluded.report_channel_id`,
    args: [
      guildId,
      fields.sub_give_role_id,
      fields.sub_remove_role_id,
      fields.domme_give_role_id,
      fields.domme_remove_role_id,
      fields.maledom_give_role_id,
      fields.maledom_remove_role_id,
      fields.report_channel_id,
    ],
  });
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
};
