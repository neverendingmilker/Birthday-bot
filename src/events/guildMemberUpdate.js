const customRoleManager = require('../features/customroles/customRoleManager');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember) {
    await customRoleManager.handleMemberUpdate(oldMember, newMember).catch((err) => {
      console.error(`[customroles] Error in guildMemberUpdate handler for ${newMember.id}:`, err);
    });
  },
};
