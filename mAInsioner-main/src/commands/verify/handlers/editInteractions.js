const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');
const { buildReportEmbed } = require('./reportEmbed');

const FIELD_LABELS = {
  verification: 'Verification',
  social: 'Social',
};

// Step 1 (select menu from /verify edit): admin picked which field to change —
// show a modal to type the new value, prefilled with the current one.
async function handleEditSelect(interaction) {
  const [, , reportIdStr] = interaction.customId.split(':');
  const reportId = Number(reportIdStr);
  const field = interaction.values[0];

  const report = await verifyManager.getReportById(reportId);
  if (!report) {
    await interaction.update({ content: '⚠️ This report no longer exists.', components: [] });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`vfedit:modal:${reportId}:${field}`)
    .setTitle(`Edit ${FIELD_LABELS[field]}`);

  const input = new TextInputBuilder()
    .setCustomId('value')
    .setLabel(FIELD_LABELS[field])
    .setStyle(TextInputStyle.Paragraph)
    .setValue(report[field])
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
}

// Step 2 (modal submit): update the DB record and edit the original report embed
// in place — everything else (member, verified on, user id, color) stays the same.
async function handleEditModalSubmit(interaction) {
  const [, , reportIdStr, field] = interaction.customId.split(':');
  const reportId = Number(reportIdStr);
  const newValue = interaction.fields.getTextInputValue('value');

  const report = await verifyManager.getReportById(reportId);
  if (!report) {
    await interaction.reply({ content: '⚠️ This report no longer exists.', ephemeral: true });
    return;
  }

  await verifyManager.updateReportField(reportId, field, newValue);

  const guild = interaction.guild;
  const channel = guild.channels.cache.get(report.channel_id);
  const message = channel ? await channel.messages.fetch(report.message_id).catch(() => null) : null;

  if (!message) {
    await interaction.reply({
      content: '✅ Saved, but I couldn\'t find the original report message to update it (it may have been deleted).',
      ephemeral: true,
    });
    return;
  }

  const targetUser = await interaction.client.users.fetch(report.user_id).catch(() => null);
  const moderator = report.moderator_id
    ? await interaction.client.users.fetch(report.moderator_id).catch(() => null)
    : null;

  const updatedEmbed = buildReportEmbed({
    type: report.type,
    userMention: targetUser ? `${targetUser}` : `<@${report.user_id}>`,
    userAvatarURL: targetUser ? targetUser.displayAvatarURL() : null,
    userId: report.user_id,
    verification: field === 'verification' ? newValue : report.verification,
    social: field === 'social' ? newValue : report.social,
    verifiedAtSeconds: report.verified_at,
    moderatorMention: moderator ? `${moderator}` : report.moderator_id ? `<@${report.moderator_id}>` : 'Unknown',
  });

  await message.edit({ embeds: [updatedEmbed] });

  await interaction.reply({
    content: `✅ **${FIELD_LABELS[field]}** updated.`,
    ephemeral: true,
  });
}

module.exports = { handleEditSelect, handleEditModalSubmit };
