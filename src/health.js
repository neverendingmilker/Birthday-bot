const http = require('http');
const config = require('./config/config');

// Render (o hosting simili configurati come "Web Service") richiede che il processo
// risponda su una porta HTTP, altrimenti lo considera "non in salute". Questo NON e'
// una dashboard: e' solo una paginetta di stato, zero dipendenze extra (modulo "http" nativo).
// Torna utile anche come bersaglio per un ping esterno (es. cron-job.org) per evitare
// che il piano free vada in sleep per inattivita'.
function start(client) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(client.isReady() ? `OK - Bot online come ${client.user.tag}` : 'OK - Bot in avvio...');
  });

  server.listen(config.port, () => {
    console.log(`[health] Server di stato in ascolto sulla porta ${config.port}`);
  });

  return server;
}

module.exports = { start };
