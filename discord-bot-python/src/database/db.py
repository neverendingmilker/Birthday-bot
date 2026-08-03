"""Turso (libSQL) database connection and schema, shared by all of the bot's features.

Each "feature" of the bot has its own tables, created here explicitly so the whole
schema is easy to see in one place when adding new features.

New installs get the schema below directly. Existing installs (already deployed with
an older schema) are upgraded by _migrate(), which never touches already-saved data.

Every repository module calls `await db.ready()` before its first query in a given
process (it's a no-op after the first successful call), mirroring the JS version's
top-level `await db.ready` pattern.
"""
import asyncio
import sys

import libsql_client

from src import config

if not config.TURSO_URL or not config.TURSO_AUTH_TOKEN:
    print("❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set (turso.tech dashboard).", file=sys.stderr)
    sys.exit(1)

client = libsql_client.create_client(url=config.TURSO_URL, auth_token=config.TURSO_AUTH_TOKEN)

_SCHEMA_STATEMENTS = [
    """CREATE TABLE IF NOT EXISTS birthday_guild_config (
        guild_id TEXT PRIMARY KEY,
        birthday_role_id TEXT,
        remove_after_seconds INTEGER NOT NULL DEFAULT 86400,
        birthday_channel_id TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS birthdays (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        day INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER,
        PRIMARY KEY (guild_id, user_id)
    )""",
    """CREATE TABLE IF NOT EXISTS birthday_role_assignments (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        assigned_at INTEGER NOT NULL,
        year_assigned INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
    )""",
    """CREATE TABLE IF NOT EXISTS birthday_greetings (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        year_greeted INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
    )""",
    """CREATE TABLE IF NOT EXISTS anime_night_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        title TEXT NOT NULL,
        watched_date TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        added_by TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS verify_guild_config (
        guild_id TEXT PRIMARY KEY,
        findom_role_id TEXT,
        sub_role_id TEXT,
        verified_channel_id TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS verify_entries (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        social TEXT,
        method TEXT NOT NULL,
        verified_at INTEGER NOT NULL,
        verified_by TEXT NOT NULL,
        channel_id TEXT,
        message_id TEXT,
        PRIMARY KEY (guild_id, user_id, type)
    )""",
]


async def _create_tables() -> None:
    await client.batch(_SCHEMA_STATEMENTS)


async def _migrate() -> None:
    """Upgrades an already-existing database created before "remove_after_seconds" and
    "birthday_channel_id" existed (back when the only option was "remove_after_hours").
    Safe to run on every startup: each step is skipped once already applied.
    """
    columns = await client.execute("PRAGMA table_info(birthday_guild_config)")
    column_names = [row["name"] for row in columns.rows]

    if "remove_after_seconds" not in column_names:
        await client.execute("ALTER TABLE birthday_guild_config ADD COLUMN remove_after_seconds INTEGER")
    if "birthday_channel_id" not in column_names:
        await client.execute("ALTER TABLE birthday_guild_config ADD COLUMN birthday_channel_id TEXT")
    if "remove_after_hours" in column_names:
        # One-time conversion from the old hours-based column to the new seconds-based one.
        # Only touches rows that haven't been migrated yet (remove_after_seconds still NULL).
        await client.execute(
            "UPDATE birthday_guild_config SET remove_after_seconds = remove_after_hours * 3600 "
            "WHERE remove_after_seconds IS NULL"
        )
    # Any row that still has no value at this point (brand new, never touched) gets the default.
    await client.execute(
        "UPDATE birthday_guild_config SET remove_after_seconds = 86400 WHERE remove_after_seconds IS NULL"
    )


_ready_lock = asyncio.Lock()
_initialized = False


async def ready() -> None:
    global _initialized
    if _initialized:
        return
    async with _ready_lock:
        if _initialized:
            return
        try:
            await _create_tables()
            await _migrate()
            print("[db] Turso schema ready.")
            _initialized = True
        except Exception as err:  # noqa: BLE001
            print(f"[db] Error initializing/migrating the Turso schema: {err}", file=sys.stderr)
            sys.exit(1)


def rows_as_dicts(result_set) -> list[dict]:
    """Turns a libsql_client ResultSet into a list of plain dicts keyed by column name,
    equivalent to the row objects returned by the JS @libsql/client."""
    return [dict(zip(result_set.columns, row)) for row in result_set.rows]
