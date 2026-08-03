const { SlashCommandBuilder } = require('discord.js');
const { handleRun } = require('./handlers/run');

const data = new SlashCommandBuilder()
  .setName('comboroles')
  .setDescription('Mostra gli utenti che hanno tutti i ruoli indicati (opzionalmente escludendone altri con BUT)')
  .addRoleOption((opt) => opt.setName('ruolo1').setDescription('Primo ruolo richiesto').setRequired(true))
  .addRoleOption((opt) => opt.setName('ruolo2').setDescription('Secondo ruolo richiesto').setRequired(true))
  .addRoleOption((opt) => opt.setName('ruolo3').setDescription('Terzo ruolo richiesto (opzionale)').setRequired(false))
  .addRoleOption((opt) => opt.setName('ruolo4').setDescription('Quarto ruolo richiesto (opzionale)').setRequired(false))
  .addRoleOption((opt) => opt.setName('ruolo5').setDescription('Quinto ruolo richiesto (opzionale)').setRequired(false))
  .addRoleOption((opt) =>
    opt.setName('but1').setDescription('BUT: escludi chi ha anche questo ruolo (opzionale)').setRequired(false)
  )
  .addRoleOption((opt) =>
    opt.setName('but2').setDescription('BUT: escludi chi ha anche questo ruolo (opzionale)').setRequired(false)
  )
  .addRoleOption((opt) =>
    opt.setName('but3').setDescription('BUT: escludi chi ha anche questo ruolo (opzionale)').setRequired(false)
  );

async function execute(interaction) {
  return handleRun(interaction);
}

module.exports = { data, execute };
