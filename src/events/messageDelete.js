const starboardManager = require('../features/starboard/starboardManager');

module.exports = {
  name: 'messageDelete',
  once: false,
  async execute(message) {
    await starboardManager.handleMessageDelete(message).catch((err) => {
      console.error('[starboard] Error handling message delete:', err);
    });
  },
};
