const cron = require('node-cron');
const config = require('../../config/config');
const repo = require('./birthdayRepository');

const ORE_IN_MS = 60 * 60 * 1000;

async function assegnaRuoloCompleanno(client) {
  const oggi = new Date();
  const day = oggi.getDate();
  const month = oggi.getMonth() + 1;
  const year = oggi.getFullYear();

  const festeggiati = await repo.getBirthdaysForToday(day, month);

  for (const { guild_id: guildId, user_id: userId } of festeggiati) {
    try {
      if (await repo.hasAssignmentThisYear(guildId, userId, year)) continue;

      const guildConfig = await repo.getGuildConfig(guildId);
      if (!guildConfig.birthday_role_id) continue; // nessun ruolo configurato in questo server

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue; // il bot non e' (piu') in questo server

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue; // l'utente non e' (piu') nel server

      await member.roles.add(guildConfig.birthday_role_id);
      await repo.recordRoleAssignment(guildId, userId, Date.now(), year);
      console.log(`[birthday] Ruolo assegnato a ${userId} nel server ${guildId}`);
    } catch (err) {
      console.error(`[birthday] Errore assegnando il ruolo a ${userId} (${guildId}):`, err);
    }
  }
}

async function rimuoviRuoliScaduti(client) {
  const assegnazioni = await repo.getAllActiveAssignments();
  const now = Date.now();

  for (const a of assegnazioni) {
    try {
      const guildConfig = await repo.getGuildConfig(a.guild_id);
      const scadenzaMs = guildConfig.remove_after_hours * ORE_IN_MS;

      if (now - a.assigned_at < scadenzaMs) continue; // non ancora scaduto

      const guild = client.guilds.cache.get(a.guild_id);
      if (!guild) {
        await repo.removeRoleAssignment(a.guild_id, a.user_id);
        continue;
      }

      const member = await guild.members.fetch(a.user_id).catch(() => null);
      if (member && guildConfig.birthday_role_id) {
        await member.roles.remove(guildConfig.birthday_role_id).catch(() => null);
      }

      await repo.removeRoleAssignment(a.guild_id, a.user_id);
      console.log(`[birthday] Ruolo rimosso a ${a.user_id} nel server ${a.guild_id}`);
    } catch (err) {
      console.error(`[birthday] Errore rimuovendo il ruolo a ${a.user_id} (${a.guild_id}):`, err);
    }
  }
}

function start(client) {
  // Ogni giorno a mezzanotte, nel fuso orario configurato: assegna il ruolo a chi compie gli anni oggi
  cron.schedule('0 0 * * *', () => assegnaRuoloCompleanno(client), {
    timezone: config.timezone,
  });

  // Ogni 5 minuti: controlla se qualche ruolo va rimosso (timer scaduto)
  cron.schedule('*/5 * * * *', () => rimuoviRuoliScaduti(client), {
    timezone: config.timezone,
  });

  // Controllo anche all'avvio, utile se il bot e' stato offline a mezzanotte
  assegnaRuoloCompleanno(client);
  rimuoviRuoliScaduti(client);

  console.log('[birthday] Scheduler avviato.');
}

module.exports = { start };
