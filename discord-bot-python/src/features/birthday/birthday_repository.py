from src.database import db

DEFAULT_REMOVE_AFTER_SECONDS = 86400  # 24h

# --- Guild config (birthday role + removal timer + greeting channel) ---


async def get_guild_config(guild_id: str) -> dict:
    await db.ready()
    result = await db.client.execute("SELECT * FROM birthday_guild_config WHERE guild_id = ?", [guild_id])
    rows = db.rows_as_dicts(result)

    if rows:
        row = rows[0]
        return {
            "guild_id": row["guild_id"],
            "birthday_role_id": row["birthday_role_id"],
            "remove_after_seconds": int(row["remove_after_seconds"] or DEFAULT_REMOVE_AFTER_SECONDS),
            "birthday_channel_id": row["birthday_channel_id"],
        }
    return {
        "guild_id": guild_id,
        "birthday_role_id": None,
        "remove_after_seconds": DEFAULT_REMOVE_AFTER_SECONDS,
        "birthday_channel_id": None,
    }


async def set_birthday_role(guild_id: str, role_id: str) -> None:
    await db.ready()
    await db.client.execute(
        f"""INSERT INTO birthday_guild_config (guild_id, birthday_role_id, remove_after_seconds, birthday_channel_id)
            VALUES (?, ?, {DEFAULT_REMOVE_AFTER_SECONDS}, NULL)
            ON CONFLICT(guild_id) DO UPDATE SET birthday_role_id = excluded.birthday_role_id""",
        [guild_id, role_id],
    )


async def set_remove_after_seconds(guild_id: str, seconds: int) -> None:
    await db.ready()
    await db.client.execute(
        """INSERT INTO birthday_guild_config (guild_id, birthday_role_id, remove_after_seconds, birthday_channel_id)
           VALUES (?, NULL, ?, NULL)
           ON CONFLICT(guild_id) DO UPDATE SET remove_after_seconds = excluded.remove_after_seconds""",
        [guild_id, seconds],
    )


async def set_birthday_channel(guild_id: str, channel_id: str) -> None:
    await db.ready()
    await db.client.execute(
        f"""INSERT INTO birthday_guild_config (guild_id, birthday_role_id, remove_after_seconds, birthday_channel_id)
            VALUES (?, NULL, {DEFAULT_REMOVE_AFTER_SECONDS}, ?)
            ON CONFLICT(guild_id) DO UPDATE SET birthday_channel_id = excluded.birthday_channel_id""",
        [guild_id, channel_id],
    )


# --- User birthdays ---


async def upsert_birthday(guild_id: str, user_id: str, day: int, month: int, year: int | None) -> None:
    await db.ready()
    await db.client.execute(
        """INSERT INTO birthdays (guild_id, user_id, day, month, year)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(guild_id, user_id) DO UPDATE SET
             day = excluded.day, month = excluded.month, year = excluded.year""",
        [guild_id, user_id, day, month, year],
    )


async def get_birthday(guild_id: str, user_id: str) -> dict | None:
    await db.ready()
    result = await db.client.execute(
        "SELECT * FROM birthdays WHERE guild_id = ? AND user_id = ?", [guild_id, user_id]
    )
    rows = db.rows_as_dicts(result)
    return rows[0] if rows else None


async def delete_birthday(guild_id: str, user_id: str) -> None:
    await db.ready()
    await db.client.execute("DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?", [guild_id, user_id])


async def get_birthdays_for_today(day: int, month: int) -> list[dict]:
    """All users celebrating today (day/month), across every guild."""
    await db.ready()
    result = await db.client.execute("SELECT * FROM birthdays WHERE day = ? AND month = ?", [day, month])
    return db.rows_as_dicts(result)


async def get_all_birthdays_in_guild(guild_id: str) -> list[dict]:
    """All birthdays saved in ONE guild (used by /birthday list)."""
    await db.ready()
    result = await db.client.execute("SELECT * FROM birthdays WHERE guild_id = ?", [guild_id])
    return db.rows_as_dicts(result)


# --- Active birthday role assignments (to know when to remove them) ---


async def record_role_assignment(guild_id: str, user_id: str, assigned_at: int, year_assigned: int) -> None:
    await db.ready()
    await db.client.execute(
        """INSERT INTO birthday_role_assignments (guild_id, user_id, assigned_at, year_assigned)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(guild_id, user_id) DO UPDATE SET
             assigned_at = excluded.assigned_at, year_assigned = excluded.year_assigned""",
        [guild_id, user_id, assigned_at, year_assigned],
    )


async def get_all_active_assignments() -> list[dict]:
    await db.ready()
    result = await db.client.execute("SELECT * FROM birthday_role_assignments")
    return db.rows_as_dicts(result)


async def remove_role_assignment(guild_id: str, user_id: str) -> None:
    await db.ready()
    await db.client.execute(
        "DELETE FROM birthday_role_assignments WHERE guild_id = ? AND user_id = ?", [guild_id, user_id]
    )


async def has_assignment_this_year(guild_id: str, user_id: str, year: int) -> bool:
    await db.ready()
    result = await db.client.execute(
        "SELECT 1 FROM birthday_role_assignments WHERE guild_id = ? AND user_id = ? AND year_assigned = ?",
        [guild_id, user_id, year],
    )
    return len(result.rows) > 0


# --- Birthday greetings already sent (tracked separately from the role, so a
# greeting can still fire even in servers with no birthday role configured) ---


async def has_greeted_this_year(guild_id: str, user_id: str, year: int) -> bool:
    await db.ready()
    result = await db.client.execute(
        "SELECT 1 FROM birthday_greetings WHERE guild_id = ? AND user_id = ? AND year_greeted = ?",
        [guild_id, user_id, year],
    )
    return len(result.rows) > 0


async def record_greeting(guild_id: str, user_id: str, year: int) -> None:
    await db.ready()
    await db.client.execute(
        """INSERT INTO birthday_greetings (guild_id, user_id, year_greeted)
           VALUES (?, ?, ?)
           ON CONFLICT(guild_id, user_id) DO UPDATE SET year_greeted = excluded.year_greeted""",
        [guild_id, user_id, year],
    )
