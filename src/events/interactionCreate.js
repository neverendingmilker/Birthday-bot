module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction) {
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (err) {
          console.error(`Error in autocomplete for "${interaction.commandName}":`, err);
        }
      }
      return;
    }

    if (interaction.isButton()) {
      const [prefix] = interaction.customId.split(':');
      if (prefix === 'vfck' || prefix === 'vfckcancel') {
        try {
          const { handleCheckButton } = require('../commands/verify/handlers/check');
          await handleCheckButton(interaction);
        } catch (err) {
          console.error('Error handling verify check button:', err);
          const errorReply = { content: '⚠️ An error occurred while handling this button.', components: [] };
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply(errorReply).catch(() => null);
          } else {
            await interaction.update(errorReply).catch(() => null);
          }
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error executing command "${interaction.commandName}":`, err);

      const errorReply = {
        content: '⚠️ An error occurred while executing this command.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply).catch(() => null);
      } else {
        await interaction.reply(errorReply).catch(() => null);
      }
    }
  },
};
