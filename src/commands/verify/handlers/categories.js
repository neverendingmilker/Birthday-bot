const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

function requireManageRoles(interaction) {
  return interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles);
}

const CATEGORY_LABELS = { dom: 'Dom', sub: 'Sub' };

async function handleCategoriesAdd(interaction) {
  if (!requireManageRoles(interaction)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const category = interaction.options.getString('category');
  const role = interaction.options.getRole('role');

  try {
    await verifyManager.addCategoryRole(interaction.guildId, category, role.id);
  } catch (err) {
    if (err instanceof verifyManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }

  await interaction.reply({
    content: `✅ ${role} is now part of the **${CATEGORY_LABELS[category]}** category.`,
    ephemeral: true,
  });
}

async function handleCategoriesList(interaction) {
  if (!requireManageRoles(interaction)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const categoryRoles = await verifyManager.listCategoryRoles(interaction.guildId);

  if (categoryRoles.dom.length === 0 && categoryRoles.sub.length === 0) {
    await interaction.reply({
      content: 'No Dom/Sub category roles configured yet. Use `/verify categories add` to add some.',
      ephemeral: true,
    });
    return;
  }

  const formatList = (ids) => (ids.length ? ids.map((id) => `<@&${id}>`).join(', ') : '_(none)_');

  await interaction.reply({
    content: `**Dom:** ${formatList(categoryRoles.dom)}\n**Sub:** ${formatList(categoryRoles.sub)}`,
    ephemeral: true,
  });
}

async function handleCategoriesRemove(interaction) {
  if (!requireManageRoles(interaction)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const category = interaction.options.getString('category');
  const role = interaction.options.getRole('role');

  try {
    await verifyManager.removeCategoryRole(interaction.guildId, category, role.id);
  } catch (err) {
    if (err instanceof verifyManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }

  await interaction.reply({
    content: `✅ ${role} removed from the **${CATEGORY_LABELS[category]}** category.`,
    ephemeral: true,
  });
}

module.exports = { handleCategoriesAdd, handleCategoriesList, handleCategoriesRemove };
