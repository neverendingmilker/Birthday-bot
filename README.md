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
        config.js    (role + removal timer + greeting channel, merged into one subcommand)
        list.js
    animenight/
      index.js       (defines /animenight and its subcommands + autocomplete, calls the handlers)
      handlers/
        add.js
        list.js
        last.js
        edit.js
    verify/
      index.js       (defines /verify config, sub, domme, maledom)
      handlers/
        config.js    (configures the give/remove roles for the 3 types + report channel, merged into one subcommand)
        verifyAction.js (shared logic used by sub/domme/maledom, not a subcommand itself)
    incident/
      index.js       (defines /incident channel, setnumber, reset)
      handlers/
        channel.js
        setnumber.js
        reset.js
    boosterlinks/
      index.js       (defines /boosterlink link, unlink, list, toggle)
      handlers/
        link.js
        unlink.js
        list.js
        toggle.js
    rolelinks/
      index.js       (defines /rolelink link, unlink, list, toggle)
      handlers/
        link.js
        unlink.js
        list.js
        toggle.js
    starboard/
      index.js       (defines /starboard create, edit, remove, list + autocomplete)
      handlers/
        create.js
        edit.js
        remove.js
        list.js
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
    incident/
      incidentManager.js     (validation + posts/refreshes the sign in Discord)
      incidentRepository.js  (SQL queries)
      incidentImage.js       (renders the sign PNG with the current count, via @napi-rs/canvas)
      incidentScheduler.js   (cron job: +1 every day at midnight)
      assets/                (base sign image + font, ported from the original Python bot)
    boosterlinks/
      boosterLinkManager.js     (validation + auto-removal logic, feature on/off toggle)
      boosterLinkRepository.js  (SQL queries: links + per-guild enabled flag)
    rolelinks/
      roleLinkManager.js     (validation + cascading removal logic, incl. "viceversa")
      roleLinkRepository.js  (SQL queries)
    starboard/
      starboardManager.js     (validation, emoji parsing, reaction counting, embed/post building)
      starboardRepository.js  (SQL queries: per-guild boards + tracked posts)
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
- `/birthday remove [user]` — anyone can remove their own saved birthday. The optional `user` option lets an **admin (Manage Roles permission)** remove someone else's instead.
- `/birthday config [role] [removeafter] [channel]` — **admin (Manage Roles permission)**: configures any combination of the three settings in one call:
  - `role:<@role>` — the role to assign on someone's birthday. Also checks the bot's role hierarchy and immediately assigns the role to anyone already celebrating today.
  - `removeafter:<duration>` — after how long to remove the role. Accepts a number followed by a unit: `s` (seconds), `m` (minutes), `h` (hours), `d` (days) — e.g. `30s`, `10m`, `24h`, `3d`. Minimum 10 seconds, maximum 30 days, default 24h.
  - `channel:<#channel>` — the text channel where automatic birthday greetings are posted. Also greets anyone already celebrating today, right away.
- `/birthday list` — shows an embed with every birthday in the server, grouped by calendar month **starting from January** (not by who's coming up soonest), sorted by day within each month; each entry still shows a day countdown to its next occurrence.

Every day at midnight (timezone set via `TZ` in `.env`) the bot checks who's celebrating and assigns the role / posts the greeting automatically; a periodic check (every 10 seconds, to support the short timers above) removes the role once the configured timer has expired. The role and the greeting are also triggered immediately (without waiting for midnight) whenever someone adds a birthday that happens to be today, or when an admin configures the role/channel while someone is already celebrating. The role and the greeting are independent of each other — a server can use either, both, or neither.

## Available commands (Mystery Anime Night feature)

- `/animenight add titles:<...> [date]` — **admin (Manage Roles permission)**: adds one or more anime to the watched list. Separate multiple titles with a comma or a slash, e.g. `Naruto, One Piece / Bleach`. The optional `date` accepts `DD/MM`, `DD/MM/YYYY`, `today`, or `yesterday`; defaults to today if omitted entirely. Every distinct date is a "session" (e.g. "Mystery Anime Night 3"), numbered chronologically.
- `/animenight list [order]` — shows the watch list as an embed **grouped by session** (10 sessions per page), paginated with ◀ Previous / Next ▶ buttons once there are more than 10. Sessions always appear in chronological order; `order` only controls how titles are sorted *within* each session — `alphabetical` (default) or `added` (the order they were added in).
- `/animenight last` — shows every anime from the most recent Mystery Anime Night **session** (i.e. the latest distinct date), not just the last few inserted rows. Also paginated if that session has many entries.
- `/animenight edit session:<...> [titles] [date]` — **admin**: edits an existing session. The `session` option has autocomplete — start typing and Discord suggests matching sessions (e.g. "Mystery Anime Night 3 — 23/10/2026 (5 anime)"), most recent first. Provide `titles` to replace the whole anime list for that session, `date` to move it to a different day (moving it onto an existing session's date merges the two), or both. Session numbers are computed dynamically from chronological order, so they stay correct even after edits.

## Available commands (Verify feature)

All `/verify` subcommands require the **Manage Roles** permission.

- `/verify config [verified_sub] [subremove] [verified_domme] [dommeremove] [verified_maledom] [maledomremove] [channel]` — configures any combination of the following in one call:
  - `verified_sub` / `verified_domme` / `verified_maledom` — the role assigned by `/verify sub`, `/verify domme`, `/verify maledom` respectively.
  - `subremove` / `dommeremove` / `maledomremove` — an **optional** role to strip from the member (if they currently have it) when that command is run — e.g. remove a generic "Unverified" or "Findomme" role once the specific Verified role is granted.
  - `channel:<#channel>` — the text channel where verification reports are posted (report format: TBD).
- `/verify sub user:<@user>` / `/verify domme user:<@user>` / `/verify maledom user:<@user>` — assigns the configured "give" role for that type (no-op if the member already has it), and removes the configured "remove" role for that type if the member currently holds it.

Each of the three types is independent — e.g. running `/verify domme` never touches the sub or maledom roles unless you explicitly configured them to overlap. The bot's role must be higher than every role it needs to touch (both give and remove), otherwise it reports which one it couldn't apply instead of failing silently. Running `/verify sub|domme|maledom` before `/verify config` has been set up for that type replies with a reminder instead of doing anything.

## Available commands (Incident feature)

Ported from a separate Python bot: a "Days since last incident" sign, kept up to date as an image in a Discord channel. All subcommands require the **Administrator** permission.

- `/incident channel channel:<#channel>` — sets the channel where the sign is posted. Also posts the sign right away with whatever count is currently set (0 the first time).
- `/incident setnumber numero:<0-100000>` — manually sets the counter to a specific number and refreshes the sign.
- `/incident reset` — sets the counter back to 0 (i.e. "an incident just happened") and refreshes the sign.

Every day at midnight (same `TZ` used by the birthday feature) the counter is incremented by 1 and the sign is regenerated, for every guild that has a channel configured. Only one sign message is ever visible at a time: posting a new one deletes the previous one first. Unlike the original bot (a 24h loop timed from the last restart), the daily increment now runs at a fixed time regardless of restarts, and does **not** also fire once at every startup — so restarting the bot never double-counts a day.

## Available commands (Custom role feature)

Tracks custom perk roles manually given to server boosters, so they get auto-removed if the person stops boosting. All subcommands require the **Manage Roles** permission.

- `/boosterlink link user:<user> role:<role>` — links a custom role to a booster.
- `/boosterlink unlink user:<user> role:<role>` — stops tracking that link (does **not** remove the role itself). `role` is optional: omit it to untrack every role linked to that user at once.
- `/boosterlink list [user]` — lists tracked links, optionally filtered to one user.
- `/boosterlink toggle enabled:<true/false>` — enables or disables auto-removal for the whole server with a single command. Existing links are kept while disabled; nothing is removed until it's turned back on.

Listens on Discord's `guildMemberUpdate` event: whenever a member who had the server's Booster role no longer has it (boost expired, manually removed, etc.), every custom role linked to them is removed and the link is deleted. Requires the bot's own role to sit above the linked role in the role list. Members with role `1090658915810820156` are always exempt from this auto-removal, even if they have linked roles and lose the Booster role.

## Available commands (Role link feature)

Generic version of the same idea, not tied to boosting: links any two roles so that losing one auto-removes the other. Requires the **Manage Roles** permission.

- `/rolelink link role1:<role> role2:<role> [viceversa:<true/false>]` — losing `role1` removes `role2`. If `viceversa` is `true` (default `false`), losing `role2` also removes `role1`.
- `/rolelink unlink role1:<role> role2:<role>` — removes that link (same role order as when it was created).
- `/rolelink list` — lists all configured role links in the server.
- `/rolelink toggle enabled:<true/false>` — enables or disables role link auto-removal for the whole server.

Also listens on `guildMemberUpdate`, same mechanism as the booster-link feature above. The bot's own role must sit above both roles involved in a link.

## Available commands (Starboard feature)

Collects popular messages (by vote count) and reposts them to a dedicated channel. A server can have several starboards, each with its own watch channel, post channel, threshold, emoji, content-type filter, and voting method — e.g. one board watching `#general` and posting to `#starboard`, and a separate one watching `#memes` and posting only images to `#best-memes` using vote buttons instead of reactions. All subcommands require the **Manage Server** permission.

- `/starboard create name:<...> watch_channel:<#channel> post_channel:<#channel> threshold:<1-1000> emojis:<...> [content_type] [voting_method]` — creates a new starboard. `emojis` accepts one or more emojis (unicode or custom server emojis) for **Reactions** mode, separated by spaces or commas, e.g. `⭐` or `⭐ 🔥`; **Buttons** mode only accepts exactly one emoji (it's shown on the button). `watch_channel` and `post_channel` must be different channels. `content_type` and `voting_method` are optional (see below), defaulting to "Any message" / "Reactions".
- `/starboard edit name:<...> [watch_channel] [post_channel] [threshold] [emojis] [content_type] [voting_method]` — updates any combination of an existing starboard's settings. The `name` option has autocomplete. Providing `emojis` replaces the whole list, it doesn't add to it.
- `/starboard remove name:<...>` — deletes a starboard's configuration. Already-posted messages/buttons are left alone but stop being tracked/updated.
- `/starboard list` — shows every starboard configured in the server, with its watch/post channels, threshold, emojis, content-type filter and voting method.

**Content-type filter** (`content_type` option) — restricts which messages are even eligible for a given starboard, regardless of votes:
- `Any message` (default) — no restriction.
- `Text only` — must have text and no image/GIF/video.
- `Images only` / `GIFs only` / `Videos only` — must include that specific kind of attachment or link embed (a GIF is never counted as a plain image, and vice versa).
- `Any media` — image, GIF, or video, regardless of caption text.
- `Text + media` — needs both a text caption and an attachment.

**Voting method** (`voting_method` option):
- `Reactions` (default) — people react on the message itself with one of the configured emojis. Reacting with more than one of them only counts once per person, and the message's own author reacting to their own message never counts.
- `Buttons` — the bot posts a reply with a single vote button under every new message in the watch channel that matches the content-type filter. Clicking the button casts your vote; clicking it again removes it (a toggle). You can't vote for your own message. The button's label always shows the live vote count, and it turns green once the threshold is reached.

Either way, a message qualifies for a starboard once **enough distinct people** have voted for it. The starboard post's count stays live as votes are added or removed — and if it drops back below the threshold, the post is **removed** from the starboard (a starboard reflects what's currently popular). If the original message is deleted, its starboard post (and, in Buttons mode, its vote button) is deleted too. The bot needs "View Channel" + "Read Message History" in the watch channel, and "View Channel" + "Send Messages" in the post channel.

## Hosting

The bot must stay **connected 24/7** (it's not an "on-demand" webapp), so avoid hosting that puts the process to sleep on inactivity without a way to "wake it up". The database is external (Turso), so the data stays safe no matter how/where the bot's process gets restarted.
