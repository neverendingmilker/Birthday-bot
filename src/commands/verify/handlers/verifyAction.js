const { EmbedBuilder } = require('discord.js');
const verifyManager = require('../../../features/verify/verifyManager');

// Runs the shared "verify someone" flow for either type ('findom' or 'sub').
// config: { type, roleId, title, color }
async function performVerification(interaction, { type, roleId, title, color }) {
  const targetUser = interaction.options.getUser('user');
  const method = interaction.options.getString('method');
  const social = interaction.options.getString('social');

  const guildConfig = await verifyManager.getGuildConfig(interaction.guildId);

  if (!roleId) {
    await interaction.reply({
      content: `⚠️ No ${type === 'findom' ? 'Findom' : 'Sub'} role is configured yet. An admin needs to run \`/verify roles\` first.`,
      ephemeral: true,
    });
    return;
  }
  if (!guildConfig.verified_channel_id) {
    await interaction.reply({
      content: "⚠️ No verification report channel is configured yet. An admin needs to run `/verify channel` first.",
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  const member = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "⚠️ Couldn't find that user in this server.", ephemeral: true });
    return;
  }

  const role = guild.roles.cache.get(roleId);
  const botMember = guild.members.me;
  if (!role) {
    await interaction.reply({
      content: `⚠️ The configured ${type} role no longer exists. An admin needs to run \`/verify roles\` again.`,
      ephemeral: true,
    });
    return;
  }
  if (!botMember || botMember.roles.highest.position <= role.position) {
    await interaction.reply({
      content: `⚠️ I can't assign ${role}: my role needs to be moved higher in the server's role list.`,
      ephemeral: true,
    });
    return;
  }

  const channel = guild.channels.cache.get(guildConfig.verified_channel_id);
  if (!channel) {
    await interaction.reply({
      content: "⚠️ The configured verification channel no longer exists. An admin needs to run `/verify channel` again.",
      ephemeral: true,
    });
    return;
  }

  await member.roles.add(role);

  const verifierName = interaction.member?.displayName || interaction.user.username;
  const verifiedAtSeconds = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: 'Member', value: `<@${targetUser.id}>` },
      { name: 'Social', value: social && social.trim() ? social.trim() : 'N/A' },
      { name: 'Verification', value: method },
      { name: 'Verified on', value: `<t:${verifiedAtSeconds}:F>` },
      { name: 'User ID', value: targetUser.id },
      { name: 'Verified by', value: verifierName }
    );

  const message = await channel.send({ embeds: [embed] });

  try {
    await verifyManager.recordVerification(
      interaction.guildId,
      targetUser.id,
      type,
      social,
      method,
      interaction.user.id,
      channel.id,
      message.id
    );
  } catch (err) {
    if (err instanceof verifyManager.ValidationError) {
      await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
      return;
    }
    throw err;
  }

  await interaction.reply({
    content: `✅ ${targetUser} has been verified as ${type === 'findom' ? 'Findom' : 'Sub'}.`,
    ephemeral: true,
  });
}

module.exports = { performVerification };
