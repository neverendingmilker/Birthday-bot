const { PermissionFlagsBits } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

function requireManageRoles(interaction) {
  return interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles);
}

async function handleComboRolesAdd(interaction) {
  if (!requireManageRoles(interaction)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const target = interaction.options.getRole('target');
  const triggerRoles = [1, 2, 3, 4, 5]
    .map((n) => interaction.options.getRole(`role${n}`))
    .filter(Boolean);
  const removeRole = interaction.options.getRole('remove');

  try {
    await verifyManager.addComboRule(
      interaction.guildId,
      target.id,
      triggerRoles.map((r) => r.id),
      removeRole ? removeRole.id : null
    );
  } catch (err) {
    if (err instanceof verifyManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }

  const triggerList = triggerRoles.map((r) => `${r}`).join(' + ');
  const removeNote = removeRole ? ` It will also remove ${removeRole} from them.` : '';

  await interaction.reply({
    content: `✅ New rule saved: a member with ${triggerList} will get ${target}.${removeNote}`,
    ephemeral: true,
  });
}

async function handleComboRolesList(interaction) {
  if (!requireManageRoles(interaction)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const rules = await verifyManager.listComboRules(interaction.guildId);
  if (rules.length === 0) {
    await interaction.reply({
      content: 'No combo rules configured yet. Use `/verify comboroles add` to create one.',
      ephemeral: true,
    });
    return;
  }

  const lines = rules.map((rule) => {
    const triggers = rule.trigger_role_ids.map((id) => `<@&${id}>`).join(' + ');
    const removeNote = rule.remove_role_id ? ` _(also removes <@&${rule.remove_role_id}>)_` : '';
    return `**#${rule.id}** — ${triggers} → <@&${rule.target_role_id}>${removeNote}`;
  });

  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}

async function handleComboRolesRemove(interaction) {
  if (!requireManageRoles(interaction)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const id = interaction.options.getInteger('id');

  try {
    const removed = await verifyManager.deleteComboRule(interaction.guildId, id);
    const triggers = removed.trigger_role_ids.map((rid) => `<@&${rid}>`).join(' + ');
    await interaction.reply({
      content: `✅ Removed rule #${id} (${triggers} → <@&${removed.target_role_id}>).`,
      ephemeral: true,
    });
  } catch (err) {
    if (err instanceof verifyManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }
}

module.exports = { handleComboRolesAdd, handleComboRolesList, handleComboRolesRemove };
