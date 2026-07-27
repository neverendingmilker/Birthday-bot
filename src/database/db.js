const { createClient } = require('@libsql/client');
const config = require('../config/config');

if (!config.turso.url || !config.turso.authToken) {
  console.error('❌ TURSO_DATABASE_URL e TURSO_AUTH_TOKEN devono essere impostati (dashboard turso.tech).');
  process.exit(1);
}

const client = createClient({
  url: config.turso.url,
  authToken: config.turso.authToken,
});

// --- Schema base, condiviso da tutte le funzioni del bot ---
// Ogni "funzione" (feature) del bot ha le sue tabelle, create qui in modo esplicito
// cosi' e' facile vedere tutto lo schema in un unico posto quando si aggiungono nuove feature.
// La creazione e' asincrona (Turso parla HTTP): "ready" va atteso prima di ogni query,
// cosa che fa gia' la repository di ogni feature.
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
).then(() => console.log('[db] Schema Turso pronto.'))
  .catch((err) => {
    console.error('[db] Errore inizializzando lo schema su Turso:', err);
    process.exit(1);
  });

module.exports = { client, ready };
