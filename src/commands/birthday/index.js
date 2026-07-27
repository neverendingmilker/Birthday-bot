const { SlashCommandBuilder } = require('discord.js');
const { handleAdd } = require('./handlers/add');
const { handleRole } = require('./handlers/role');
const { handleRemoveRole } = require('./handlers/removerole');

const data = new SlashCommandBuilder()
  .setName('birthday')
  .setDescription('Gestione compleanni')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Aggiungi (o aggiorna) il tuo compleanno')
      .addIntegerOption((opt) =>
        opt.setName('giorno').setDescription('Giorno (1-31)').setMinValue(1).setMaxValue(31).setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('mese').setDescription('Mese (1-12)').setMinValue(1).setMaxValue(12).setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('anno').setDescription('Anno di nascita (facoltativo)').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('role')
      .setDescription('[Admin] Imposta il ruolo da assegnare il giorno del compleanno')
      .addRoleOption((opt) =>
        opt.setName('ruolo').setDescription('Ruolo da assegnare').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('removerole')
      .setDescription('[Admin] Imposta dopo quante ore rimuovere il ruolo compleanno')
      .addIntegerOption((opt) =>
        opt
          .setName('timer')
          .setDescription('Numero di ore dopo le quali rimuovere il ruolo (default 24)')
          .setMinValue(1)
          .setRequired(true)
      )
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'add':
      return handleAdd(interaction);
    case 'role':
      return handleRole(interaction);
    case 'removerole':
      return handleRemoveRole(interaction);
    default:
      return interaction.reply({ content: 'Subcommand sconosciuta.', ephemeral: true });
  }
}

module.exports = { data, execute };
