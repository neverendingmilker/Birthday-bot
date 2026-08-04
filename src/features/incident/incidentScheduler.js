const cron = require('node-cron');
const config = require('../../config/config');
const { incrementAllDue } = require('./incidentManager');

// Unlike the original Python version (a 24h loop started from on_ready, so a
// restart would drift/reset the timer), this runs at a fixed time every day —
// same approach already used by the birthday feature's scheduler — so the
// count stays accurate regardless of how often the process restarts.
// Deliberately NOT also run once at startup: doing so would double-increment
// the counter on every restart between midnight ticks.
function start(client) {
  cron.schedule('0 0 * * *', () => incrementAllDue(client), {
    timezone: config.timezone,
  });

  console.log('[incident] Scheduler started.');
}

module.exports = { start };
