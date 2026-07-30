const { PermissionFlagsBits } = require('discord.js');
const birthdayManager = require('../../../features/birthday/birthdayManager');
const { celebrateDueTodayForGuild } = require('../../../features/birthday/birthdayScheduler');

async function handleChannel(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      content: '❌ You need the "Manage Roles" permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.options.getChannel('channel');

  await birthdayManager.setBirthdayChannel(interaction.guildId, channel.id);

  let message = `✅ Birthday greetings will now be posted in ${channel}`;

  const botMember = interaction.guild.members.me;
  const canSend = botMember && channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages);

  if (!canSend) {
    message += `\n⚠️ Heads up: I don't currently have permission to send messages in ${channel}. Please grant me "Send Messages" there.`;
  } else {
    // Check if anyone is already celebrating today and greet them right away,
    // in case the channel wasn't configured yet when their birthday check ran this morning.
    const results = await celebrateDueTodayForGuild(interaction.client, interaction.guildId);
    const greetedCount = results.filter((r) => r.greetingResult?.sent).length;
    if (greetedCount > 0) {
      message += `\n🎉 Also sent a birthday greeting right away for ${greetedCount} member(s) celebrating today.`;
    }
  }

  await interaction.reply({ content: message, ephemeral: true });
}

module.exports = { handleChannel };
