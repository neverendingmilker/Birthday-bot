const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const stickyManager = require('../../../features/sticky/stickyManager');

const MODAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes to fill in the modal

async function handleAdd(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: '⚠️ You need admin permissions to set up a sticky message.', ephemeral: true });
    return;
  }

  const channel = interaction.options.getChannel('channel');

  const botMember = interaction.guild.members.me;
  const canPost =
    botMember &&
    channel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
  if (!canPost) {
    await interaction.reply({
      content: `⚠️ I don't have permission to view/send messages in ${channel}.`,
      ephemeral: true,
    });
    return;
  }

  const modalCustomId = `sticky_add_modal:${interaction.id}`;
  const modal = new ModalBuilder().setCustomId(modalCustomId).setTitle('Sticky message content');

  const input = new TextInputBuilder()
    .setCustomId('content')
    .setLabel(`Message to stick in #${channel.name}`)
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(4000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);

  const submitted = await interaction
    .awaitModalSubmit({ time: MODAL_TIMEOUT_MS, filter: (i) => i.customId === modalCustomId })
    .catch(() => null);

  if (!submitted) return; // user let the modal time out, nothing to do

  const content = submitted.fields.getTextInputValue('content');

  await stickyManager.setSticky(channel, content, interaction.user.id);

  await submitted.reply({
    content: `✅ Sticky message set up in ${channel}. It will be reposted at the bottom of the channel after every new message.`,
    ephemeral: true,
  });
}

module.exports = { handleAdd };
