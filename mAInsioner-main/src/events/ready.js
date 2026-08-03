const birthdayScheduler = require('../features/birthday/birthdayScheduler');
const { warmMemberCache } = require('../features/comboroles/memberCacheWarmer');

module.exports = {
  name: 'clientReady', // renamed from 'ready': in discord.js v15 this will be the only name available
  once: true,
  execute(client) {
    console.log(`✅ Bot online as ${client.user.tag}`);

    // Every feature that needs periodic jobs or a one-off startup task
    // registers itself here. When adding new features in the future, just
    // add a line here.
    birthdayScheduler.start(client);
    warmMemberCache(client).catch((err) => console.error('[comboroles] Error warming member cache:', err));
  },
};
