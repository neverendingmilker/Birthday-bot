const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { findMembersWithRoles } = require('../../../features/comboroles/comboRolesManager');

const EMBED_COLOR = 0x5865f2;
const MAX_FIELD_LENGTH = 1024; // Discord's limit for an embed field value
const MAX_FIELDS_PER_EMBED = 25; // Discord's limit for the number of fields in one embed
const MAX_EMBED_TOTAL = 6000; // Discord's limit for the combined size of one embed
const SAFETY_MARGIN = 500; // headroom for title/description/footer/field names
const PAGE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity before buttons stop working

// Splits the member list into fields of at most MAX_FIELD_LENGTH characters each.
function chunkLines(lines) {
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > MAX_FIELD_LENGTH) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

// Packs field-chunks into pages, respecting both Discord's 25-fields-per-embed
// limit and the 6000-character total embed size limit.
function paginateChunks(chunks) {
  const budget = MAX_EMBED_TOTAL - SAFETY_MARGIN;
  const pages = [];
  let currentPage = [];
  let currentSize = 0;

  for (const chunk of chunks) {
    const wouldExceedFields = currentPage.length >= MAX_FIELDS_PER_EMBED;
    const wouldExceedSize = currentSize + chunk.length > budget;

    if ((wouldExceedFields || wouldExceedSize) && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentSize = 0;
    }

    currentPage.push(chunk);
    currentSize += chunk.length;
  }
  if (currentPage.length > 0) pages.push(currentPage);

  return pages;
}

function collectRoleOptions(interaction, names) {
  return names
    .map((name) => interaction.options.getRole(name))
    .filter(Boolean);
}

function buildBaseEmbed(interaction, requiredLabel, excludedLabel, totalUsers) {
  const descriptionLines = [`**Required roles:** ${requiredLabel}`];
  if (excludedLabel) descriptionLines.push(`**BUT (excluded):** ${excludedLabel}`);
  descriptionLines.push(`**Users found:** ${totalUsers}`);

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('🔎 Combo roles')
    .setDescription(descriptionLines.join('\n'))
    .setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });
}

function buildPageEmbed(interaction, requiredLabel, excludedLabel, totalUsers, pages, pageIndex) {
  const embed = buildBaseEmbed(interaction, requiredLabel, excludedLabel, totalUsers);
  const page = pages[pageIndex];

  page.forEach((chunk, i) => {
    const fieldNumber = pages.slice(0, pageIndex).reduce((acc, p) => acc + p.length, 0) + i + 1;
    embed.addFields({ name: `Users (block ${fieldNumber})`, value: chunk });
  });

  if (pages.length > 1) {
    embed.setFooter({
      text: `Requested by ${interaction.user.username} • Page ${pageIndex + 1}/${pages.length}`,
      iconURL: interaction.user.displayAvatarURL(),
    });
  }

  return embed;
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
    const embed = buildBaseEmbed(interaction, requiredLabel, excludedLabel, 0);
    embed.addFields({ name: 'Result', value: 'No users match these criteria.' });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const lines = [...matchingMembers.values()].map((member, i) => `${i + 1}. <@${member.id}>`);
  const chunks = chunkLines(lines);
  const pages = paginateChunks(chunks);

  let pageIndex = 0;
  const components = pages.length > 1 ? [buildRow(pageIndex, pages.length)] : [];

  await interaction.editReply({
    embeds: [buildPageEmbed(interaction, requiredLabel, excludedLabel, matchingMembers.size, pages, pageIndex)],
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
      embeds: [buildPageEmbed(interaction, requiredLabel, excludedLabel, matchingMembers.size, pages, pageIndex)],
      components: [buildRow(pageIndex, pages.length)],
    });
  });

  collector.on('end', async () => {
    await interaction.editReply({ components: [] }).catch(() => {});
  });
}

module.exports = { handleRun };
