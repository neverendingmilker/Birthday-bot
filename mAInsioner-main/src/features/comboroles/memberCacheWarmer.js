// Pre-carica la member cache di ogni guild in cui il bot è presente, una sola
// volta all'avvio. Da quel momento in poi, con l'intent GuildMembers già
// attivo, discord.js mantiene la cache aggiornata automaticamente tramite gli
// eventi guildMemberAdd/Remove/Update, senza bisogno di richiedere di nuovo
// tutta la lista via gateway (opcode 8) ad ogni comando.
async function warmMemberCache(client) {
  const guilds = [...client.guilds.cache.values()];

  const results = await Promise.allSettled(guilds.map((guild) => guild.members.fetch()));

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.warn(`[comboroles] Failed to warm member cache for guild "${guilds[i].name}":`, result.reason);
    }
  });

  const total = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`[comboroles] Member cache warmed for ${total}/${guilds.length} guild(s).`);
}

module.exports = { warmMemberCache };
