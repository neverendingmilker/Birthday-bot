# Discord Bot Modulare

Bot Discord con architettura a "compartimenti separati": ogni funzione (feature) ha la sua cartella con comandi, logica di business e accesso ai dati, completamente indipendente dalle altre.

## Architettura

```
src/
  commands/         <- Livello "Discord": definizione degli slash command
    birthday/
      index.js       (definisce /birthday e le sue subcommand, chiama gli handler)
      handlers/
        add.js
        role.js
        removerole.js
  features/         <- Livello "Business logic": una cartella per feature
    birthday/
      birthdayManager.js     (validazioni e regole)
      birthdayRepository.js  (query SQL)
      birthdayScheduler.js   (cron job: assegna/rimuove il ruolo)
  database/
    db.js           <- connessione al database Turso, schema di tutte le feature
  events/           <- eventi Discord (ready, interactionCreate...)
  utils/            <- loader automatici di comandi ed eventi
  config/
    config.js       <- lettura delle variabili d'ambiente
  index.js          <- entry point
  deploy-commands.js<- script per registrare gli slash command
```

Per aggiungere una **nuova funzione** in futuro (es. moderazione, welcome message, ecc.):
1. Crea `src/features/nomefeature/` con la sua logica e le sue tabelle in `db.js`.
2. Crea `src/commands/nomefeature/index.js` con `{ data, execute }` (viene caricato automaticamente, non serve registrarlo a mano).
3. Se serve un job periodico, crea uno scheduler e aggiungilo in `src/events/ready.js`.

Nessun file esistente va modificato per aggiungere una feature (tranne il collegamento facoltativo dello scheduler in `ready.js`).

## Setup

1. **Crea l'applicazione Discord**: vai su https://discord.com/developers/applications, crea una nuova app, vai su "Bot" e crea il bot, copia il **Token**. In "General Information" copia l'**Application ID** (= CLIENT_ID).
2. Attiva l'intent privilegiato **Server Members Intent** in Bot -> Privileged Gateway Intents (serve per assegnare/rimuovere ruoli e leggere i membri).
3. Genera il link di invito in OAuth2 -> URL Generator, scope `bot` + `applications.commands`, permessi almeno `Manage Roles`, `Send Messages`, `Use Application Commands`. Invita il bot nel tuo server.
   - ⚠️ Il ruolo del bot deve stare **più in alto** nella lista dei ruoli rispetto al ruolo "compleanno", altrimenti non potrà assegnarlo/rimuoverlo.
4. **Crea il database su Turso** (https://turso.tech, dashboard web, non serve nessun tool da installare): crea un account, crea un nuovo database, e dalla sua pagina copia la **Database URL** (inizia con `libsql://...`) e crea/copia un **Auth Token**.
5. Copia `.env.example` in `.env` e compila `DISCORD_TOKEN`, `CLIENT_ID`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (e opzionalmente `GUILD_ID` del tuo server per test istantanei).
6. Installa le dipendenze:
   ```
   npm install
   ```
7. Avvia il bot:
   ```
   npm start
   ```
   (registra da solo gli slash command ad ogni avvio, e poi si connette a Discord)

## Comandi disponibili (feature: compleanni)

- `/birthday add giorno:<1-31> mese:<1-12> [anno]` — chiunque può salvare il proprio compleanno.
- `/birthday role ruolo:<@ruolo>` — **admin (permesso Gestisci Ruoli)**: imposta il ruolo da assegnare il giorno del compleanno.
- `/birthday removerole timer:<ore>` — **admin**: imposta dopo quante ore rimuovere il ruolo (default 24).
- `/birthday list` — mostra un embed con tutti i compleanni del server, divisi per mese e ordinati dal più vicino, con il conto alla rovescia in giorni per ciascuno.

Ogni giorno a mezzanotte (fuso orario impostato in `TZ` nel `.env`) il bot controlla chi compie gli anni e assegna il ruolo automaticamente; un controllo periodico (ogni 5 minuti) rimuove il ruolo una volta scaduto il timer configurato.

## Hosting

Il bot deve restare **connesso 24/7** (non è una webapp "a richiesta"), quindi va evitato un hosting che mette il processo in sleep dopo inattività senza un modo per "risvegliarlo". Il database è esterno (Turso), quindi i dati restano al sicuro indipendentemente da dove/come viene riavviato il processo del bot.
