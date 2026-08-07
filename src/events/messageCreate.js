const stickyManager = require('../features/sticky/stickyManager');
const starboardManager = require('../features/starboard/starboardManager');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    if (!message.guild) return; // sticky/starboard only make sense in guild channels

    await stickyManager.handleNewMessage(message);

    await starboardManager.handleNewMessage(message).catch((err) => {
      console.error('[starboard] Error handling new message (vote button posting):', err);
    });
  },
};
