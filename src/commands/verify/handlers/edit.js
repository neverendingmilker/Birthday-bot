const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

async function handleEdit(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  const type = interaction.options.getString('type'); // 'findom' | 'sub'
  const socialInput = interaction.options.getString('social'); // null if not provided
  const methodInput = interaction.options.getString('method'); // null if not provided

  try {
    const updated = await verifyManager.editVerification(
      interaction.guildId,
      targetUser.id,
      type,
      socialInput === null ? undefined : socialInput,
      methodInput === null ? undefined : methodInput
    );

    let note = '';

    if (updated.channel_id && updated.message_id) {
      const channel = interaction.guild.channels.cache.get(updated.channel_id);
      const originalMessage = channel
        ? await channel.messages.fetch(updated.message_id).catch(() => null)
        : null;

      if (originalMessage && originalMessage.embeds[0]) {
        const newEmbed = EmbedBuilder.from(originalMessage.embeds[0])
          .spliceFields(1, 1, { name: 'Social', value: updated.social || 'N/A' })
          .spliceFields(2, 1, { name: 'Verification', value: updated.method });
        await originalMessage.edit({ embeds: [newEmbed] });
      } else {
        note = "\n⚠️ Couldn't find the original report message to update it, but the record itself was updated.";
      }
    }

    const typeLabel = type === 'findom' ? 'Findom' : 'Sub';
    await interaction.reply({
      content: `✏️ ${typeLabel} verification updated for ${targetUser}.${note}`,
      ephemeral: true,
    });
  } catch (err) {
    if (err instanceof verifyManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
    } else {
      throw err;
    }
  }
}

module.exports = { handleEdit };
