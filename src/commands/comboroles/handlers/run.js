const { EmbedBuilder } = require('discord.js');
const { findMembersWithRoles } = require('../../../features/comboroles/comboRolesManager');

const EMBED_COLOR = 0x5865f2;
const MAX_FIELD_LENGTH = 1024; // limite Discord per il valore di un campo embed
const MAX_FIELDS = 25; // limite Discord per numero di campi in un embed

// Raggruppa le righe in più campi da MAX_FIELD_LENGTH caratteri l'uno, così
// da non troncare la lista anche con molti utenti.
function chunkLines(lines) {
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > MAX_FIELD_LENGTH) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  const truncated = chunks.length > MAX_FIELDS;
  return { chunks: chunks.slice(0, MAX_FIELDS), truncated };
}

function collectRoleOptions(interaction, names) {
  return names
    .map((name) => interaction.options.getRole(name))
    .filter(Boolean);
}

async function handleRun(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const requiredRoles = collectRoleOptions(interaction, ['ruolo1', 'ruolo2', 'ruolo3', 'ruolo4', 'ruolo5']);
  const excludedRoles = collectRoleOptions(interaction, ['but1', 'but2', 'but3']);

  // Evita di richiedere e allo stesso tempo escludere lo stesso ruolo.
  const conflicting = requiredRoles.find((r) => excludedRoles.some((e) => e.id === r.id));
  if (conflicting) {
    await interaction.editReply({
      content: `⚠️ Il ruolo ${conflicting} è indicato sia tra i ruoli richiesti che tra i ruoli BUT: rimuovilo da uno dei due.`,
    });
    return;
  }

  if (requiredRoles.length < 2) {
    await interaction.editReply({
      content: '⚠️ Indica almeno due ruoli (ruolo1 e ruolo2) da combinare.',
    });
    return;
  }

  const matchingMembers = await findMembersWithRoles(
    interaction.guild,
    requiredRoles.map((r) => r.id),
    excludedRoles.map((r) => r.id)
  );

  const requiredLabel = requiredRoles.map((r) => `${r}`).join(' + ');
  const excludedLabel = excludedRoles.length ? excludedRoles.map((r) => `${r}`).join(', ') : null;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('🔎 Combo ruoli')
    .setFooter({
      text: `Richiesto da ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

  const descriptionLines = [`**Ruoli richiesti:** ${requiredLabel}`];
  if (excludedLabel) descriptionLines.push(`**BUT (esclusi):** ${excludedLabel}`);
  descriptionLines.push(`**Utenti trovati:** ${matchingMembers.size}`);
  embed.setDescription(descriptionLines.join('\n'));

  if (matchingMembers.size === 0) {
    embed.addFields({ name: 'Risultato', value: 'Nessun utente soddisfa questi criteri.' });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const lines = [...matchingMembers.values()].map((member, i) => `${i + 1}. <@${member.id}>`);
  const { chunks, truncated } = chunkLines(lines);

  chunks.forEach((chunk, i) => {
    embed.addFields({
      name: chunks.length > 1 ? `Utenti (${i + 1}/${chunks.length})` : 'Utenti',
      value: chunk,
    });
  });

  if (truncated) {
    embed.addFields({
      name: 'Nota',
      value: 'La lista è stata troncata per limiti di Discord: raffina i filtri per una lista più corta.',
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { handleRun };
