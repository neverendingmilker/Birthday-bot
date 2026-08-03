import time

from src.database import db


def _now_ms() -> int:
    return int(time.time() * 1000)


async def add_entries(guild_id: str, titles: list[str], watched_date: str, added_by: str) -> None:
    """Inserts multiple anime entries in a single batch (all sharing the same watched
    date and "added at" timestamp, since they come from one /animenight add call)."""
    await db.ready()
    added_at = _now_ms()

    statements = [
        (
            "INSERT INTO anime_night_entries (guild_id, title, watched_date, added_at, added_by) "
            "VALUES (?, ?, ?, ?, ?)",
            [guild_id, title, watched_date, added_at, added_by],
        )
        for title in titles
    ]

    await db.client.batch(statements)


async def get_all_entries(guild_id: str) -> list[dict]:
    await db.ready()
    result = await db.client.execute(
        "SELECT * FROM anime_night_entries WHERE guild_id = ? ORDER BY id ASC", [guild_id]
    )
    return db.rows_as_dicts(result)


async def get_last_entries(guild_id: str, limit: int) -> list[dict]:
    await db.ready()
    result = await db.client.execute(
        "SELECT * FROM anime_night_entries WHERE guild_id = ? ORDER BY added_at DESC, id DESC LIMIT ?",
        [guild_id, limit],
    )
    return db.rows_as_dicts(result)


async def get_entries_for_date(guild_id: str, watched_date: str) -> list[dict]:
    """All entries for a single session (= all anime sharing the same watched_date)."""
    await db.ready()
    result = await db.client.execute(
        "SELECT * FROM anime_night_entries WHERE guild_id = ? AND watched_date = ?", [guild_id, watched_date]
    )
    return db.rows_as_dicts(result)


async def replace_session(guild_id: str, old_date: str, new_date: str, titles: list[str], edited_by: str) -> None:
    """Replaces the entire title list of a session, optionally moving it to a new date
    in the same operation (delete + reinsert, in a single batch)."""
    await db.ready()
    added_at = _now_ms()

    statements = [
        ("DELETE FROM anime_night_entries WHERE guild_id = ? AND watched_date = ?", [guild_id, old_date]),
        *[
            (
                "INSERT INTO anime_night_entries (guild_id, title, watched_date, added_at, added_by) "
                "VALUES (?, ?, ?, ?, ?)",
                [guild_id, title, new_date, added_at, edited_by],
            )
            for title in titles
        ],
    ]

    await db.client.batch(statements)


async def update_session_date(guild_id: str, old_date: str, new_date: str) -> None:
    """Moves a session to a new date without touching its titles. If the new date
    matches an existing session, they naturally merge (grouping is purely by date)."""
    await db.ready()
    await db.client.execute(
        "UPDATE anime_night_entries SET watched_date = ? WHERE guild_id = ? AND watched_date = ?",
        [new_date, guild_id, old_date],
    )
