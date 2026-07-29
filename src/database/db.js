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
// New installs get the schema below directly. Existing installs (already deployed
// with an older schema) are upgraded by migrate() further down, which never
// touches already-saved data.
async function createTables() {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS birthday_guild_config (
        guild_id TEXT PRIMARY KEY,
        birthday_role_id TEXT,
        remove_after_seconds INTEGER NOT NULL DEFAULT 86400,
        birthday_channel_id TEXT
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
      `CREATE TABLE IF NOT EXISTS birthday_greetings (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        year_greeted INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS anime_night_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        title TEXT NOT NULL,
        watched_date TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        added_by TEXT
      )`,
    ],
    'write'
  );
}

// Upgrades an already-existing database created before "remove_after_seconds" and
// "birthday_channel_id" existed (back when the only option was "remove_after_hours").
// Safe to run on every startup: each step is skipped once already applied.
async function migrate() {
  const columns = await client.execute('PRAGMA table_info(birthday_guild_config)');
  const columnNames = columns.rows.map((row) => row.name);

  if (!columnNames.includes('remove_after_seconds')) {
    await client.execute('ALTER TABLE birthday_guild_config ADD COLUMN remove_after_seconds INTEGER');
  }
  if (!columnNames.includes('birthday_channel_id')) {
    await client.execute('ALTER TABLE birthday_guild_config ADD COLUMN birthday_channel_id TEXT');
  }
  if (columnNames.includes('remove_after_hours')) {
    // One-time conversion from the old hours-based column to the new seconds-based one.
    // Only touches rows that haven't been migrated yet (remove_after_seconds still NULL).
    await client.execute(
      'UPDATE birthday_guild_config SET remove_after_seconds = remove_after_hours * 3600 WHERE remove_after_seconds IS NULL'
    );
  }
  // Any row that still has no value at this point (brand new, never touched) gets the default.
  await client.execute(
    'UPDATE birthday_guild_config SET remove_after_seconds = 86400 WHERE remove_after_seconds IS NULL'
  );
}

const ready = createTables()
  .then(() => migrate())
  .then(() => console.log('[db] Turso schema ready.'))
  .catch((err) => {
    console.error('[db] Error initializing/migrating the Turso schema:', err);
    process.exit(1);
  });

module.exports = { client, ready };
