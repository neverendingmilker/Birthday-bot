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
        channel.js
        list.js
    animenight/
      index.js       (defines /animenight and its subcommands + autocomplete, calls the handlers)
      handlers/
        add.js
        list.js
        last.js
        edit.js
    verify/
      index.js       (defines /verify and its subcommands, calls the handlers)
      handlers/
        findom.js
        sub.js
        edit.js
        roles.js
        channel.js
        verifyAction.js (shared helper used by findom.js and sub.js, not a subcommand itself)
  features/         <- "Business logic" layer: one folder per feature
    birthday/
      birthdayManager.js     (validation and rules)
      birthdayRepository.js  (SQL queries)
      birthdayScheduler.js   (cron job: assigns/removes the role, sends greetings)
    animenight/
      animeNightManager.js     (validation, title/date parsing, sessions, sorting)
      animeNightRepository.js  (SQL queries)
    verify/
      verifyManager.js     (validation and rules)
      verifyRepository.js  (SQL queries)
  database/
    db.js           <- Turso database connection, schema for all features
  events/           <- Discord events (clientReady, interactionCreate...)
  utils/            <- automatic loaders for commands and events, shared helpers (duration parsing, pagination)
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

- `/birthday add day:<1-31> month:<1-12> [year] [user]` — anyone can save their own birthday. If today happens to be that date, the birthday role is assigned right away. The optional `user` option lets an **admin (Manage Roles permission)** set someone else's birthday instead of their own.
- `/birthday role role:<@role>` — **admin (Manage Roles permission)**: sets the role to assign on someone's birthday. Also checks the bot's role hierarchy and immediately assigns the role to anyone already celebrating today.
- `/birthday removerole timer:<duration>` — **admin**: sets after how long to remove the role. Accepts a number followed by a unit: `s` (seconds), `m` (minutes), `h` (hours), `d` (days) — e.g. `30s`, `10m`, `24h`, `3d`. Minimum 10 seconds, maximum 30 days, default 24h.
- `/birthday channel channel:<#channel>` — **admin**: sets the text channel where automatic birthday greetings are posted. Also greets anyone already celebrating today, right away.
- `/birthday list` — shows an embed with every birthday in the server, grouped by month and sorted by the soonest upcoming, with a day countdown for each.

Every day at midnight (timezone set via `TZ` in `.env`) the bot checks who's celebrating and assigns the role / posts the greeting automatically; a periodic check (every 10 seconds, to support the short timers above) removes the role once the configured timer has expired. The role and the greeting are also triggered immediately (without waiting for midnight) whenever someone adds a birthday that happens to be today, or when an admin configures the role/channel while someone is already celebrating. The role and the greeting are independent of each other — a server can use either, both, or neither.

## Available commands (Mystery Anime Night feature)

- `/animenight add titles:<...> [date]` — **admin (Manage Roles permission)**: adds one or more anime to the watched list. Separate multiple titles with a comma or a slash, e.g. `Naruto, One Piece / Bleach`. The optional `date` accepts `DD/MM`, `DD/MM/YYYY`, `today`, or `yesterday`; defaults to today if omitted entirely. Every distinct date is a "session" (e.g. "Mystery Anime Night 3"), numbered chronologically.
- `/animenight list [order]` — shows the watch list as an embed **grouped by session** (10 sessions per page), paginated with ◀ Previous / Next ▶ buttons once there are more than 10. Sessions always appear in chronological order; `order` only controls how titles are sorted *within* each session — `alphabetical` (default) or `added` (the order they were added in).
- `/animenight last` — shows every anime from the most recent Mystery Anime Night **session** (i.e. the latest distinct date), not just the last few inserted rows. Also paginated if that session has many entries.
- `/animenight edit session:<...> [titles] [date]` — **admin**: edits an existing session. The `session` option has autocomplete — start typing and Discord suggests matching sessions (e.g. "Mystery Anime Night 3 — 23/10/2026 (5 anime)"), most recent first. Provide `titles` to replace the whole anime list for that session, `date` to move it to a different day (moving it onto an existing session's date merges the two), or both. Session numbers are computed dynamically from chronological order, so they stay correct even after edits.

## Available commands (Verify feature)

All `/verify` subcommands require the **Manage Roles** permission.

- `/verify roles [findom] [sub]` — sets the role assigned by `/verify findom` and/or `/verify sub`. Provide either or both.
- `/verify channel channel:<#channel>` — sets the text channel where verification reports are posted.
- `/verify findom user:<@user> method:<...> [social]` — verifies someone as Findom: assigns the configured Findom role and posts a report to the configured channel with Member, Social (or "N/A" if omitted), Verification (the `method` value), Verified on (date/time), User ID, and Verified by (the admin who ran the command).
- `/verify sub user:<@user> method:<...> [social]` — same as above, but assigns the Sub role and posts a "Sub Verification" report instead.
- `/verify edit user:<@user> type:<Findom|Sub> [social] [method]` — edits the Social and/or Method of an existing verification. If the original report message can still be found, it's edited in place to match; otherwise you're told the record was updated but the message couldn't be found.

Running `/verify findom` or `/verify sub` again on an already-verified user overwrites their previous record and posts a brand new report (treated as a fresh verification); use `/verify edit` instead if you just need to fix a typo in an existing one.

- `/verify check user:<@user>` — **admin**: looks at the roles the user already holds on the server and auto-assigns the matching "Verified" role, based on these rules (checked in order):
  1. Has both **Male** and **Findomme** → assigns **Verified Maledomme**
  2. Has **Findomme** (without Male) → assigns **Verified Findomme**
  3. Has any of **Finsub**, **RT Slave**, **Switch**, **Gaming slave**, **Lurker** → assigns **Verified sub**

  Role names are matched case-insensitively and must already exist on the server (create them first if missing). The three "Verified" roles are kept mutually exclusive — running the command again also removes a stale one if the user's roles changed. When the outcome is Verified Findomme or Verified Maledomme, the plain "Findomme" role is also removed from the user. This doesn't post a report to the verification channel or touch the `/verify findom`/`sub` records; it's a separate, purely role-based check. The bot's role must be higher than the target "Verified" role (and than "Findomme", when it needs removing) in the role list.

## Hosting

The bot must stay **connected 24/7** (it's not an "on-demand" webapp), so avoid hosting that puts the process to sleep on inactivity without a way to "wake it up". The database is external (Turso), so the data stays safe no matter how/where the bot's process gets restarted.
