const { PermissionFlagsBits } = require('discord.js');
const roleLinkManager = require('../../../features/rolelinks/roleLinkManager');

async function handleLink(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const roleA = interaction.options.getRole('role1');
  const roleB = interaction.options.getRole('role2');
  const bidirectional = interaction.options.getBoolean('viceversa') ?? false;

  try {
    await roleLinkManager.link(interaction.guild, roleA, roleB, bidirectional, interaction.user.id);
  } catch (err) {
    if (err instanceof roleLinkManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }

  const description = bidirectional
    ? `✅ Linked: losing ${roleA} removes ${roleB}, **and** losing ${roleB} removes ${roleA}.`
    : `✅ Linked: losing ${roleA} removes ${roleB}.`;

  await interaction.reply({ content: description, ephemeral: true });
}

module.exports = { handleLink };
