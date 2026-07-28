const birthdayScheduler = require('../features/birthday/birthdayScheduler');

module.exports = {
  name: 'clientReady', // renamed from 'ready': in discord.js v15 this will be the only name available
  once: true,
  execute(client) {
    console.log(`✅ Bot online as ${client.user.tag}`);

    // Every feature that needs periodic jobs registers itself here.
    // When adding new features in the future, just add a line here.
    birthdayScheduler.start(client);
  },
};
