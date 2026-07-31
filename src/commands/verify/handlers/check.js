const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

const BUTTON_PREFIX = 'vfck';
const CANCEL_PREFIX = 'vfckcancel';

// Looks up a role on the guild by name, case-insensitively. Only used for "Age verified",
// which isn't part of the combo-rule system (it just tracks whether the member holds any
// configured target role).
function findRoleByName(guild, name) {
  return guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

// Adds/removes "Age verified" so it tracks whether the member ends up holding any of the
// target roles configured via /verify comboroles.
async function syncAgeVerified(guild, member, botMember, hasAnyVerifiedRole) {
  const ageRole = findRoleByName(guild, verifyManager.ROLE_NAMES.ageVerified);
  if (!ageRole) return '';

  if (botMember.roles.highest.position <= ageRole.position) {
    return hasAnyVerifiedRole && !member.roles.cache.has(ageRole.id)
      ? ' ⚠️ Couldn\'t add "Age verified": my role needs to be moved higher in the role list.'
      : '';
  }

  if (hasAnyVerifiedRole && !member.roles.cache.has(ageRole.id)) {
    await member.roles.add(ageRole);
    return ' "Age verified" was added.';
  }
  if (!hasAnyVerifiedRole && member.roles.cache.has(ageRole.id)) {
    await member.roles.remove(ageRole);
    return ' "Age verified" was removed.';
  }
  return '';
}

// Applies one combo rule to a member: assigns the target role, keeps all configured target
// roles mutually exclusive, removes the rule's linked role (if any), and syncs "Age verified".
// Shared between the automatic match in handleCheck and the manual button flow below.
async function applyComboRule(guild, member, botMember, rule, allTargetIds) {
  const targetRole = guild.roles.cache.get(rule.target_role_id);
  if (!targetRole) {
    return { error: `⚠️ Rule #${rule.id} points to a role that no longer exists on this server.` };
  }
  if (!botMember || botMember.roles.highest.position <= targetRole.position) {
    return { error: `⚠️ I can't assign ${targetRole}: my role needs to be moved higher in the server's role list.` };
  }

  for (const otherId of allTargetIds) {
    if (otherId === targetRole.id) continue;
    const otherRole = guild.roles.cache.get(otherId);
    if (otherRole && member.roles.cache.has(otherRole.id) && botMember.roles.highest.position > otherRole.position) {
      await member.roles.remove(otherRole);
    }
  }

  const alreadyHadIt = member.roles.cache.has(targetRole.id);
  if (!alreadyHadIt) {
    await member.roles.add(targetRole);
  }

  let removeNote = '';
  if (rule.remove_role_id) {
    const removeRole = guild.roles.cache.get(rule.remove_role_id);
    if (removeRole && member.roles.cache.has(removeRole.id)) {
      if (botMember.roles.highest.position > removeRole.position) {
        await member.roles.remove(removeRole);
        removeNote = ` ${removeRole} was removed.`;
      } else {
        removeNote = ` ⚠️ Couldn't remove ${removeRole}: my role needs to be moved higher in the role list.`;
      }
    }
  }

  const hasAnyVerifiedRole = allTargetIds.some((id) => member.roles.cache.has(id));
  const ageVerifiedNote = await syncAgeVerified(guild, member, botMember, hasAnyVerifiedRole);

  return {
    targetRole,
    alreadyHadIt,
    note: `${removeNote}${ageVerifiedNote}`,
  };
}

// Builds the "which one is this?" buttons — one per distinct target role configured via
// /verify comboroles, chunked into rows of 5 (Discord's limit per row), plus a cancel button.
function buildManualPromptComponents(guild, comboRules, targetUserId) {
  const seen = new Set();
  const buttons = [];

  for (const rule of comboRules) {
    if (seen.has(rule.target_role_id)) continue;
    const role = guild.roles.cache.get(rule.target_role_id);
    if (!role) continue;
    seen.add(rule.target_role_id);

    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${BUTTON_PREFIX}:${targetUserId}:${rule.id}`)
        .setLabel(role.name.slice(0, 80))
        .setStyle(ButtonStyle.Primary)
    );
  }

  const rows = [];
  for (let i = 0; i < buttons.length && rows.length < 4; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${CANCEL_PREFIX}:${targetUserId}`).setLabel('None of these').setStyle(ButtonStyle.Secondary)
    )
  );

  return rows;
}

// Auto-assigns a role based on the combo rules configured via /verify comboroles: a member
// holding ALL of a rule's trigger roles gets that rule's target role. Matches by role ID,
// so emoji/whitespace/text differences in role names never cause a mismatch.
//
// If Dom/Sub categories are configured (/verify categories) and the member holds none of
// those roles, this asks an admin to manually pick the outcome instead of guessing.
async function handleCheck(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  const guild = interaction.guild;

  const member = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "⚠️ Couldn't find that user in this server.", ephemeral: true });
    return;
  }

  const comboRules = await verifyManager.listComboRules(interaction.guildId);
  if (comboRules.length === 0) {
    await interaction.reply({
      content: '⚠️ No combo rules configured yet. Use `/verify comboroles add` to create one first.',
      ephemeral: true,
    });
    return;
  }

  const memberRoleIds = [...member.roles.cache.keys()];
  const categoryRoles = await verifyManager.listCategoryRoles(interaction.guildId);
  const categoriesConfigured = categoryRoles.dom.length > 0 || categoryRoles.sub.length > 0;

  if (categoriesConfigured && !verifyManager.hasAnyCategoryRole(memberRoleIds, categoryRoles)) {
    const rows = buildManualPromptComponents(guild, comboRules, targetUser.id);
    await interaction.reply({
      content:
        `⚠️ ${targetUser} doesn't have a Dom or Sub category role, so I can't tell which one applies. ` +
        `How should they be verified?`,
      components: rows,
      ephemeral: true,
    });
    return;
  }

  const botMember = guild.members.me;
  const winningRule = verifyManager.determineComboRule(comboRules, memberRoleIds);

  if (!winningRule) {
    await interaction.reply({
      content:
        `⚠️ ${targetUser} doesn't match any configured combo rule. Check \`/verify comboroles list\` ` +
        `against the roles they currently hold.`,
      ephemeral: true,
    });
    return;
  }

  const allTargetIds = [...new Set(comboRules.map((r) => r.target_role_id))];
  const result = await applyComboRule(guild, member, botMember, winningRule, allTargetIds);

  if (result.error) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: result.alreadyHadIt
      ? `✅ ${targetUser} already had ${result.targetRole} (no change needed).${result.note}`
      : `✅ ${targetUser} verified: assigned ${result.targetRole} (rule #${winningRule.id}).${result.note}`,
    ephemeral: true,
  });
}

// Handles clicks on the manual-verification buttons shown above. Routed here from
// events/interactionCreate.js for any button customId starting with "vfck:" or "vfckcancel:".
async function handleCheckButton(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.update({ content: '❌ You need the "Manage Roles" permission to use this.', components: [] });
    return;
  }

  const [prefix, targetUserId, ruleId] = interaction.customId.split(':');
  const guild = interaction.guild;

  if (prefix === CANCEL_PREFIX) {
    await interaction.update({ content: '❌ Cancelled — no role was changed.', components: [] });
    return;
  }

  const member = await guild.members.fetch(targetUserId).catch(() => null);
  if (!member) {
    await interaction.update({ content: "⚠️ Couldn't find that user in this server anymore.", components: [] });
    return;
  }

  const comboRules = await verifyManager.listComboRules(interaction.guildId);
  const rule = comboRules.find((r) => String(r.id) === ruleId);
  if (!rule) {
    await interaction.update({ content: '⚠️ That rule no longer exists (it may have been deleted).', components: [] });
    return;
  }

  const botMember = guild.members.me;
  const allTargetIds = [...new Set(comboRules.map((r) => r.target_role_id))];
  const result = await applyComboRule(guild, member, botMember, rule, allTargetIds);

  if (result.error) {
    await interaction.update({ content: result.error, components: [] });
    return;
  }

  await interaction.update({
    content: result.alreadyHadIt
      ? `✅ <@${targetUserId}> already had ${result.targetRole} (no change needed).${result.note}`
      : `✅ <@${targetUserId}> verified: assigned ${result.targetRole} (manual choice).${result.note}`,
    components: [],
  });
}

module.exports = { handleCheck, handleCheckButton, BUTTON_PREFIX, CANCEL_PREFIX };
