# Discord Bot (Python)

Conversione in Python del bot Discord originariamente scritto in JavaScript
(discord.js). Struttura modulare identica: funzionalità divise in compartimenti
separati (`features/`, `commands/`, `database/`).

## Stack

- [discord.py](https://discordpy.readthedocs.io/) 2.4+ (slash command tramite `app_commands`)
- [libsql-client](https://github.com/libsql/libsql-client-py) per il database Turso (libSQL)
- `aiohttp` per la pagina di stato HTTP (già dipendenza di discord.py)
- Python 3.11+ richiesto (per `zoneinfo` e la sintassi `X | None`)

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate        # su Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # poi compila i valori
```

Variabili richieste in `.env`:

- `DISCORD_TOKEN` — token del bot (Developer Portal → Bot → Token)
- `CLIENT_ID` — Application ID (Developer Portal → General Information)
- `GUILD_ID` — (opzionale) ID di un singolo server per registrare i comandi lì
  soltanto (aggiornamento istantaneo, utile in sviluppo). Lasciare vuoto per la
  registrazione globale (fino a 1h di propagazione).
- `TZ` — timezone usata per calcolare la "mezzanotte" nel controllo compleanni
  (es. `Europe/Rome`)
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — dashboard [turso.tech](https://turso.tech)
- `PORT` — porta della pagina di stato HTTP (default `3000`)

Nel Developer Portal, sotto **Bot → Privileged Gateway Intents**, abilita
**Server Members Intent** (necessario per assegnare/rimuovere ruoli e recuperare
i membri).

## Avvio

Prima registra gli slash command su Discord, poi avvia il bot:

```bash
python -m src.deploy_commands   # registra/aggiorna gli slash command
python -m src.main              # avvia il bot
```

(equivalente ai due script npm `deploy` e `start` della versione JS)

## Struttura del progetto

```
src/
  config.py                  # variabili d'ambiente
  bot.py                     # client Discord, registrazione comandi, error handler
  main.py                    # entry point
  deploy_commands.py         # script di registrazione slash command
  health.py                  # pagina di stato HTTP (per hosting tipo Render)
  database/
    db.py                    # connessione Turso + schema + migrazioni
  features/
    birthday/                # logica: validazione date, ruolo compleanno, scheduler
    animenight/               # logica: sessioni "Mystery Anime Night"
    verify/                  # logica: verifiche Findom/Sub
  commands/
    birthday/                # slash command /birthday + handler delle risposte
    animenight/                # slash command /animenight + handler delle risposte
    verify/                  # slash command /verify + handler delle risposte
  utils/
    duration.py               # parsing "30s", "10m", "24h", "3d"
    pagination.py              # embed paginati con bottoni ◀ ▶
    permissions.py             # controllo permesso "Manage Roles"
```

## Funzionalità

- **`/birthday`**: `add`, `role`, `removerole`, `channel`, `list` — salvataggio
  compleanni, ruolo automatico assegnato/rimosso dopo un timer configurabile,
  messaggio di auguri automatico in un canale dedicato.
- **`/animenight`**: `add`, `list`, `last`, `edit` — registro delle serate
  "Mystery Anime Night", raggruppate automaticamente in sessioni per data.
- **`/verify`**: `findom`, `sub`, `edit`, `roles`, `channel` — verifica utenti
  con assegnazione ruolo e report in un canale dedicato.

## Note sulla conversione

- `node-cron` → `discord.ext.tasks` (loop giornaliero a mezzanotte nel timezone
  configurato + controllo scadenze ogni 10 secondi).
- Il client Turso Node (`@libsql/client`) → `libsql-client` Python, stessa API
  SQL, stesso schema.
- I permessi e i messaggi di errore ricalcano esattamente quelli della versione
  JS per non cambiare l'esperienza utente.
