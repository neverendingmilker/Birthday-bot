const { EmbedBuilder } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

// Shared embed layout for verification reports — used both when a report is first
// posted (verifyAction.js) and when it's edited afterwards (edit flow).
function buildReportEmbed({
  type,
  userMention,
  userAvatarURL,
  userId,
  verification,
  social,
  verifiedAtSeconds,
  moderatorMention,
}) {
  return new EmbedBuilder()
    .setColor(verifyManager.TYPE_COLORS[type])
    .setThumbnail(userAvatarURL || null)
    .setDescription(
      [
        `**Member:** ${userMention}`,
        `**Verification:** ${verification}`,
        `**Social:** ${social}`,
        `**User ID:** ${userId}`,
        `**Verified on:** <t:${verifiedAtSeconds}:F>`,
        `**Verified by:** ${moderatorMention}`,
      ].join('\n')
    );
}

module.exports = { buildReportEmbed };
