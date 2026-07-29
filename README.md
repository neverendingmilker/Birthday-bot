# Modular Discord Bot

Discord bot with a "separate compartments" architecture: each feature has its own folder with commands, business logic, and data access, fully independent from the others.

## Architecture

```
src/
  commands/         <- "Discord" layer: slash command definitions
    birthday/
      index.js       (defines /birthday and its subcommands, calls the handlers)
      handlers/
        add.js
        role.js
        removerole.js
        list.js
  features/         <- "Business logic" layer: one folder per feature
    birthday/
      birthdayManager.js     (validation and rules)
      birthdayRepository.js  (SQL queries)
      birthdayScheduler.js   (cron job: assigns/removes the role)
  database/
    db.js           <- Turso database connection, schema for all features
  events/           <- Discord events (clientReady, interactionCreate...)
  utils/            <- automatic loaders for commands and events
  config/
    config.js       <- reads environment variables
  index.js          <- entry point
  deploy-commands.js<- script to register slash commands
```

To add a **new feature** in the future (e.g. moderation, welcome messages, etc.):
1. Create `src/features/featurename/` with its logic and its tables in `db.js`.
2. Create `src/commands/featurename/index.js` exporting `{ data, execute }` (it's loaded automatically, no manual registration needed).
3. If it needs a periodic job, create a scheduler and hook it up in `src/events/ready.js`.

No existing file needs to change to add a feature (except the optional scheduler hookup in `ready.js`).

## Setup

1. **Create the Discord application**: go to https://discord.com/developers/applications, create a new app, go to "Bot" and create the bot, copy the **Token**. In "General Information" copy the **Application ID** (= CLIENT_ID).
2. Enable the privileged **Server Members Intent** in Bot -> Privileged Gateway Intents (needed to assign/remove roles and read members).
3. Generate the invite link in OAuth2 -> URL Generator, scopes `bot` + `applications.commands`, permissions at least `Manage Roles`, `Send Messages`, `Use Application Commands`. Invite the bot to your server.
   - ⚠️ The bot's role must be **higher** than the "birthday" role in the role list, otherwise it won't be able to assign/remove it.
4. **Create the database on Turso** (https://turso.tech, web dashboard, nothing to install): create an account, create a new database, and from its page copy the **Database URL** (starts with `libsql://...`) and create/copy an **Auth Token**.
5. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `CLIENT_ID`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (and optionally `GUILD_ID` for instant testing on your own server).
6. Install dependencies:
   ```
   npm install
   ```
7. Start the bot:
   ```
   npm start
   ```
   (it registers the slash commands automatically on every start, then connects to Discord)

## Available commands (birthday feature)

- `/birthday add day:<1-31> month:<1-12> [year]` — anyone can save their own birthday. If today happens to be that date, the birthday role is assigned right away.
- `/birthday role role:<@role>` — **admin (Manage Roles permission)**: sets the role to assign on someone's birthday. Also checks the bot's role hierarchy and immediately assigns the role to anyone already celebrating today.
- `/birthday removerole timer:<duration>` — **admin**: sets after how long to remove the role. Accepts a number followed by a unit: `s` (seconds), `m` (minutes), `h` (hours), `d` (days) — e.g. `30s`, `10m`, `24h`, `3d`. Minimum 10 seconds, maximum 30 days, default 24h.
- `/birthday channel channel:<#channel>` — **admin**: sets the text channel where automatic birthday greetings are posted. Also greets anyone already celebrating today, right away.
- `/birthday list` — shows an embed with every birthday in the server, grouped by month and sorted by the soonest upcoming, with a day countdown for each.

Every day at midnight (timezone set via `TZ` in `.env`) the bot checks who's celebrating and assigns the role / posts the greeting automatically; a periodic check (every 10 seconds, to support the short timers above) removes the role once the configured timer has expired. The role and the greeting are also triggered immediately (without waiting for midnight) whenever someone adds a birthday that happens to be today, or when an admin configures the role/channel while someone is already celebrating. The role and the greeting are independent of each other — a server can use either, both, or neither.

## Hosting

The bot must stay **connected 24/7** (it's not an "on-demand" webapp), so avoid hosting that puts the process to sleep on inactivity without a way to "wake it up". The database is external (Turso), so the data stays safe no matter how/where the bot's process gets restarted.
