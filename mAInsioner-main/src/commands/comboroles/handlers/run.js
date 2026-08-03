const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { findMembersWithRoles } = require('../../../features/comboroles/comboRolesManager');

const EMBED_COLOR = 0x5865f2;
const CONTENT_BUDGET = 1900; // stays under Discord's 2000-char message content limit, with margin
const PAGE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity before buttons stop working

// The mention list is sent in the message *content* (not in the embed): Discord
// only resolves and displays usernames for mentions written in the content
// that are actually allowed to ping — suppressed/non-pinging mentions do NOT
// carry the resolved user data, which is what caused "Unknown User" before.
// Real pings are intentionally allowed here (see conversation): the command
// is only used in a private channel visible to the requester.
const REAL_MENTIONS = { parse: ['users'] };

// Groups the mention lines into pages that each fit within Discord's message
// content length limit.
function paginateLines(lines) {
  const pages = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > CONTENT_BUDGET) {
      if (current) pages.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) pages.push(current);

  return pages;
}

function collectRoleOptions(interaction, names) {
  return names
    .map((name) => interaction.options.getRole(name))
    .filter(Boolean);
}

function buildEmbed(interaction, requiredLabel, excludedLabel, totalUsers, pageIndex, totalPages) {
  const descriptionLines = [`**Required roles:** ${requiredLabel}`];
  if (excludedLabel) descriptionLines.push(`**BUT (excluded):** ${excludedLabel}`);
  descriptionLines.push(`**Users found:** ${totalUsers}`);

  const footerText =
    totalPages > 1
      ? `Requested by ${interaction.user.username} • Page ${pageIndex + 1}/${totalPages}`
      : `Requested by ${interaction.user.username}`;

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('🔎 Combo roles')
    .setDescription(descriptionLines.join('\n'))
    .setFooter({ text: footerText, iconURL: interaction.user.displayAvatarURL() });
}

function buildRow(pageIndex, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('comboroles_prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('comboroles_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === totalPages - 1)
  );
}

async function handleRun(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const requiredRoles = collectRoleOptions(interaction, ['role1', 'role2', 'role3', 'role4', 'role5']);
  const excludedRoles = collectRoleOptions(interaction, ['but1', 'but2', 'but3']);

  // Prevent the same role from being both required and excluded.
  const conflicting = requiredRoles.find((r) => excludedRoles.some((e) => e.id === r.id));
  if (conflicting) {
    await interaction.editReply({
      content: `⚠️ The role ${conflicting} is listed both among the required roles and the BUT roles: remove it from one of the two.`,
    });
    return;
  }

  if (requiredRoles.length < 2) {
    await interaction.editReply({
      content: '⚠️ Please specify at least two roles (role1 and role2) to combine.',
    });
    return;
  }

  const matchingMembers = await findMembersWithRoles(
    interaction.guild,
    requiredRoles.map((r) => r.id),
    excludedRoles.map((r) => r.id)
  );

  const requiredLabel = requiredRoles.map((r) => `${r}`).join(' + ');
  const excludedLabel = excludedRoles.length ? excludedRoles.map((r) => `${r}`).join(', ') : null;

  if (matchingMembers.size === 0) {
    const embed = buildEmbed(interaction, requiredLabel, excludedLabel, 0, 0, 1);
    await interaction.editReply({ embeds: [embed], content: 'No users match these criteria.' });
    return;
  }

  const lines = [...matchingMembers.values()].map((member, i) => `${i + 1}. <@${member.id}>`);
  const pages = paginateLines(lines);

  let pageIndex = 0;
  const components = pages.length > 1 ? [buildRow(pageIndex, pages.length)] : [];

  await interaction.editReply({
    embeds: [buildEmbed(interaction, requiredLabel, excludedLabel, matchingMembers.size, pageIndex, pages.length)],
    content: pages[pageIndex],
    allowedMentions: REAL_MENTIONS,
    components,
  });

  if (pages.length <= 1) return;

  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: PAGE_TIMEOUT_MS,
  });

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({ content: 'Only the person who ran the command can change pages.', ephemeral: true });
      return;
    }

    if (buttonInteraction.customId === 'comboroles_prev') pageIndex = Math.max(0, pageIndex - 1);
    if (buttonInteraction.customId === 'comboroles_next') pageIndex = Math.min(pages.length - 1, pageIndex + 1);

    await buttonInteraction.update({
      embeds: [buildEmbed(interaction, requiredLabel, excludedLabel, matchingMembers.size, pageIndex, pages.length)],
      content: pages[pageIndex],
      allowedMentions: REAL_MENTIONS,
      components: [buildRow(pageIndex, pages.length)],
    });
  });

  collector.on('end', async () => {
    await interaction.editReply({ components: [] }).catch(() => {});
  });
}

module.exports = { handleRun };
