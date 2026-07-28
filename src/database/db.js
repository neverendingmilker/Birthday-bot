const { createClient } = require('@libsql/client');
const config = require('../config/config');

if (!config.turso.url || !config.turso.authToken) {
  console.error('❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set (turso.tech dashboard).');
  process.exit(1);
}

const client = createClient({
  url: config.turso.url,
  authToken: config.turso.authToken,
});

// --- Base schema, shared by all of the bot's features ---
// Each "feature" of the bot has its own tables, created here explicitly so the
// whole schema is easy to see in one place when adding new features.
// Creation is asynchronous (Turso talks HTTP): "ready" must be awaited before any
// query, which every feature's repository already does.
const ready = client.batch(
  [
    `CREATE TABLE IF NOT EXISTS birthday_guild_config (
      guild_id TEXT PRIMARY KEY,
      birthday_role_id TEXT,
      remove_after_hours INTEGER NOT NULL DEFAULT 24
    )`,
    `CREATE TABLE IF NOT EXISTS birthdays (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER,
      PRIMARY KEY (guild_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS birthday_role_assignments (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      assigned_at INTEGER NOT NULL,
      year_assigned INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )`,
  ],
  'write'
).then(() => console.log('[db] Turso schema ready.'))
  .catch((err) => {
    console.error('[db] Error initializing the Turso schema:', err);
    process.exit(1);
  });

module.exports = { client, ready };
