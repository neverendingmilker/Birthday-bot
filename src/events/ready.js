const birthdayScheduler = require('../features/birthday/birthdayScheduler');

module.exports = {
  name: 'clientReady', // rinominato da 'ready': in discord.js v15 sara' l'unico nome disponibile
  once: true,
  execute(client) {
    console.log(`✅ Bot online come ${client.user.tag}`);

    // Ogni feature che ha bisogno di job periodici si registra qui.
    // Aggiungendo nuove funzioni in futuro, basta aggiungere una riga qui.
    birthdayScheduler.start(client);
  },
};
