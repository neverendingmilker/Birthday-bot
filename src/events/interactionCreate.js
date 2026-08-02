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

    if (interaction.isButton() && interaction.customId.startsWith('quiz:choice:')) {
      try {
        const quizManager = require('../features/quiz/quizManager');
        await quizManager.handleButtonAnswer(interaction);
      } catch (err) {
        console.error('Error handling quiz answer button:', err);
        await interaction
          .reply({ content: '⚠️ An error occurred while recording your answer.', ephemeral: true })
          .catch(() => null);
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('vfedit:select:')) {
      try {
        const { handleEditSelect } = require('../commands/verify/handlers/editInteractions');
        await handleEditSelect(interaction);
      } catch (err) {
        console.error('Error handling verify edit select menu:', err);
        await interaction
          .update({ content: '⚠️ An error occurred while handling this selection.', components: [] })
          .catch(() => null);
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('vfedit:modal:')) {
      try {
        const { handleEditModalSubmit } = require('../commands/verify/handlers/editInteractions');
        await handleEditModalSubmit(interaction);
      } catch (err) {
        console.error('Error handling verify edit modal submit:', err);
        const errorReply = { content: '⚠️ An error occurred while saving this change.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply).catch(() => null);
        } else {
          await interaction.reply(errorReply).catch(() => null);
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
