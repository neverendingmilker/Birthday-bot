const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

// Merges into one subcommand the give/remove role for all three verification types
// (sub, domme, maledom), the report channel, and the role allowed to run those three
// commands — provide any combination of the 8 options in a single call.
async function handleConfig(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const options = {
    subGive: interaction.options.getRole('subgive'),
    subRemove: interaction.options.getRole('subremove'),
    dommeGive: interaction.options.getRole('dommegive'),
    dommeRemove: interaction.options.getRole('dommeremove'),
    maledomGive: interaction.options.getRole('maledomgive'),
    maledomRemove: interaction.options.getRole('maledomremove'),
    allowedRole: interaction.options.getRole('allowedrole'),
  };
  const channel = interaction.options.getChannel('channel');

  const provided = [...Object.values(options), channel].filter(Boolean);
  if (provided.length === 0) {
    await interaction.reply({
      content: '⚠️ Provide at least one setting to change.',
      ephemeral: true,
    });
    return;
  }

  const updates = {};
  const messages = [];

  const describe = (key, label, verb) => {
    const role = options[key];
    if (!role) return;
    updates[key] = role.id;
    messages.push(`**${label}** → ${verb} ${role}`);
  };

  describe('subGive', 'Sub', 'give');
  describe('subRemove', 'Sub', 'remove (if present)');
  describe('dommeGive', 'Domme', 'give');
  describe('dommeRemove', 'Domme', 'remove (if present)');
  describe('maledomGive', 'Maledom', 'give');
  describe('maledomRemove', 'Maledom', 'remove (if present)');

  if (options.allowedRole) {
    updates.allowedRole = options.allowedRole.id;
    messages.push(
      `**Allowed role** → ${options.allowedRole} can now use \`/verify sub\`, \`/verify domme\` and \`/verify maledom\` (in addition to anyone with "Manage Roles").`
    );
  }

  if (channel) {
    updates.channel = channel.id;
    const botMember = interaction.guild.members.me;
    const canSend = botMember && channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages);
    if (!canSend) {
      messages.push(
        `**Report channel** → ${channel}\n⚠️ Heads up: I don't currently have permission to send messages in ${channel}. Please grant me "Send Messages" there.`
      );
    } else {
      messages.push(`**Report channel** → ${channel}`);
    }
  }

  await verifyManager.setConfig(interaction.guildId, updates);

  await interaction.reply({
    content: `✅ Updated:\n${messages.map((m) => `• ${m}`).join('\n')}`,
    ephemeral: true,
  });
}

module.exports = { handleConfig };
