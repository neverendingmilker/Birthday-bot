# Bot commands

Full list of every slash command, grouped by feature. "[Admin]" marks a subcommand that requires the
**Administrator** permission at runtime; "[Mod]" marks one gated by the **Manage Roles** permission
(also enforced as the command's default Discord permission, so it's hidden from anyone without it).

---

## 🛠️ Feature toggle — `/disablefeature`

| Command | Description |
|---|---|
| `/disablefeature feature enabled` | [Admin] Enables or disables one of the bot's features for this server. `feature` is a dropdown: Anime Night, Birthday, Booster Links, Incident Counter, Role Links, Sticky Messages, Suggestions, Verification. Disabling a feature keeps its saved data, but stops its automatic behavior and blocks its commands until it's re-enabled. |

---

## 🎂 Birthdays — `/birthday`

| Command | Description |
|---|---|
| `/birthday add day month [year] [user]` | Adds/updates your own birthday. With `user` ([Admin]) sets it for someone else. |
| `/birthday remove [user]` | Removes your own birthday. With `user` ([Admin]) removes someone else's. |
| `/birthday config [role] [removeafter] [channel]` | [Admin] Configures the role assigned on someone's birthday, how long before removing it (e.g. `30s`, `10m`, `24h`, `3d`), and the channel for greetings. |
| `/birthday list` | Shows every birthday in the server, grouped by month. |

Every day the bot automatically assigns the birthday role to whoever's celebrating, sends greetings in the configured channel, and removes the role after the configured time.

---

## 🎬 Mystery Anime Night — `/animenight`

| Command | Description |
|---|---|
| `/animenight add titles [date]` | [Admin] Adds one or more anime to the watched list (titles separated by comma or `/`). Date is optional, defaults to today. |
| `/animenight list [order]` | Shows the full watched anime list, grouped by session. |
| `/animenight last` | Shows the anime from the most recent session. |
| `/animenight edit session [titles] [date]` | [Admin] Edits an existing session (titles and/or date). |

---

## ✅ User verification — `/verify`

| Command | Description |
|---|---|
| `/verify config` | [Admin] Configures the roles to assign for sub/domme/maledom, the shared role to remove, the report channel, and an extra role allowed to use the verification commands. |
| `/verify sub user verification` | [Admin] Verifies a user as Sub: assigns the role, removes the configured role (if any), posts a report. |
| `/verify domme user verification social` | [Admin] Same as above, for Domme (includes the Social field). |
| `/verify maledom user verification social` | [Admin] Same as above, for Maledom (includes the Social field). |
| `/verify edit user` | [Admin] Edits the Verification/Social fields of a user's last report. |

If a user already had a previous report, the old one is replaced by the new one.

---

## 📌 Sticky messages — `/sticky`

| Command | Description |
|---|---|
| `/sticky add channel message` | [Admin] Sets (or replaces) the sticky message for a channel. The message is typed directly as a command option, not through a popup window. |
| `/sticky remove channel` | [Admin] Removes the sticky message from a channel. |
| `/sticky list` | Shows every sticky message configured in the server. |

The message gets reposted at the bottom of the channel after every new message (deleting the old one first, waiting 10 seconds between the deletion and the repost).

---

## 💡 Suggestions — `/suggestion`

| Command | Description |
|---|---|
| `/suggestion add text` | Submits a new suggestion. |
| `/suggestion edit number text` | Edits one of your own pending suggestions. |
| `/suggestion list` | Shows every suggestion still waiting for a decision. |
| `/suggestion approve number` | [Admin] Approves a suggestion. |
| `/suggestion reject number` | [Admin] Rejects a suggestion. |
| `/suggestion channel set channel` | [Admin] Sets the channel where suggestions are posted. |
| `/suggestion channel remove` | [Admin] Removes the configured channel. |

Admins can also approve/reject by reacting directly to the suggestion's own message.

---

## 🔎 Combined role search — `/comboroles`

| Command | Description |
|---|---|
| `/comboroles role1 [role2] [role3] [role4] [role5] [but1] [but2] [but3]` | Shows the users who have **all** the given roles, excluding (with `but1`-`but3`) anyone who also has one of those roles. Paginated results. Open to everyone. |

---

## 🪧 Days since last incident — `/incident`

Requires the **Administrator** permission (the command itself is hidden from anyone else).

| Command | Description |
|---|---|
| `/incident channel channel` | Sets the channel where the "Days since last incident" sign is kept updated. |
| `/incident setnumber numero` | Manually sets the counter to a specific number. |
| `/incident reset` | Resets the counter to 0 (use it when an incident just happened). |

The counter automatically increases by 1 every day at midnight; only one message is ever kept visible at a time.

---

## 🚀 Booster custom roles — `/boosterlink`

Requires the **Manage Roles** permission.

| Command | Description |
|---|---|
| `/boosterlink link user role` | Links a custom role to a booster. |
| `/boosterlink unlink user [role]` | Unlinks a specific role, or **all** of the user's linked roles if `role` is omitted. |
| `/boosterlink list [user]` | Lists active links, optionally filtered by user. |

When a user loses Discord's Booster role (boost expired, manually removed, etc.), every custom role linked to them gets automatically removed. Users with role `1090658915810820156` are always excluded from this removal.

---

## 🔗 Linking two roles — `/rolelink`

Requires the **Manage Roles** permission. Generic version of the same mechanism, not tied to boosting.

| Command | Description |
|---|---|
| `/rolelink link role1 role2 [viceversa]` | Links role1 → role2: losing role1 removes role2. With `viceversa:true` it also works the other way. |
| `/rolelink unlink role1 role2` | Removes a link (same order used when it was created). |
| `/rolelink list` | Lists every link configured in the server. |
