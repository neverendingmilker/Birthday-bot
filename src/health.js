const http = require('http');
const config = require('./config/config');

// Render (or similar hosting configured as a "Web Service") requires the process to
// respond on an HTTP port, otherwise it's considered "unhealthy". This is NOT a
// dashboard: it's just a status page, zero extra dependencies (native "http" module).
// It's also handy as a target for an external ping (e.g. cron-job.org) to prevent
// the free plan from going to sleep due to inactivity.
function start(client) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(client.isReady() ? `OK - Bot online as ${client.user.tag}` : 'OK - Bot starting...');
  });

  server.listen(config.port, () => {
    console.log(`[health] Status server listening on port ${config.port}`);
  });

  return server;
}

module.exports = { start };
