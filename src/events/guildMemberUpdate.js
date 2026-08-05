const boosterLinkManager = require('../features/boosterlinks/boosterLinkManager');
const roleLinkManager = require('../features/rolelinks/roleLinkManager');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember) {
    await boosterLinkManager.handleMemberUpdate(oldMember, newMember).catch((err) => {
      console.error(`[boosterlinks] Error in guildMemberUpdate handler for ${newMember.id}:`, err);
    });
    await roleLinkManager.handleMemberUpdate(oldMember, newMember).catch((err) => {
      console.error(`[rolelinks] Error in guildMemberUpdate handler for ${newMember.id}:`, err);
    });
  },
};
