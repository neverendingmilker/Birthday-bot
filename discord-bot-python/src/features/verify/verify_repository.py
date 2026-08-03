from src.database import db

# --- Guild config (which roles to assign, where to post reports) ---


async def get_guild_config(guild_id: str) -> dict:
    await db.ready()
    result = await db.client.execute("SELECT * FROM verify_guild_config WHERE guild_id = ?", [guild_id])
    rows = db.rows_as_dicts(result)

    if rows:
        row = rows[0]
        return {
            "guild_id": row["guild_id"],
            "findom_role_id": row["findom_role_id"],
            "sub_role_id": row["sub_role_id"],
            "verified_channel_id": row["verified_channel_id"],
        }
    return {"guild_id": guild_id, "findom_role_id": None, "sub_role_id": None, "verified_channel_id": None}


async def set_findom_role(guild_id: str, role_id: str) -> None:
    await db.ready()
    await db.client.execute(
        """INSERT INTO verify_guild_config (guild_id, findom_role_id, sub_role_id, verified_channel_id)
           VALUES (?, ?, NULL, NULL)
           ON CONFLICT(guild_id) DO UPDATE SET findom_role_id = excluded.findom_role_id""",
        [guild_id, role_id],
    )


async def set_sub_role(guild_id: str, role_id: str) -> None:
    await db.ready()
    await db.client.execute(
        """INSERT INTO verify_guild_config (guild_id, findom_role_id, sub_role_id, verified_channel_id)
           VALUES (?, NULL, ?, NULL)
           ON CONFLICT(guild_id) DO UPDATE SET sub_role_id = excluded.sub_role_id""",
        [guild_id, role_id],
    )


async def set_verified_channel(guild_id: str, channel_id: str) -> None:
    await db.ready()
    await db.client.execute(
        """INSERT INTO verify_guild_config (guild_id, findom_role_id, sub_role_id, verified_channel_id)
           VALUES (?, NULL, NULL, ?)
           ON CONFLICT(guild_id) DO UPDATE SET verified_channel_id = excluded.verified_channel_id""",
        [guild_id, channel_id],
    )


# --- Verification records (one per guild + user + type) ---


async def upsert_verification(
    guild_id: str,
    user_id: str,
    type_: str,
    social: str | None,
    method: str,
    verified_at: int,
    verified_by: str,
    channel_id: str | None,
    message_id: str | None,
) -> None:
    await db.ready()
    await db.client.execute(
        """INSERT INTO verify_entries
             (guild_id, user_id, type, social, method, verified_at, verified_by, channel_id, message_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(guild_id, user_id, type) DO UPDATE SET
             social = excluded.social,
             method = excluded.method,
             verified_at = excluded.verified_at,
             verified_by = excluded.verified_by,
             channel_id = excluded.channel_id,
             message_id = excluded.message_id""",
        [guild_id, user_id, type_, social, method, verified_at, verified_by, channel_id, message_id],
    )


async def get_verification(guild_id: str, user_id: str, type_: str) -> dict | None:
    await db.ready()
    result = await db.client.execute(
        "SELECT * FROM verify_entries WHERE guild_id = ? AND user_id = ? AND type = ?",
        [guild_id, user_id, type_],
    )
    rows = db.rows_as_dicts(result)
    return rows[0] if rows else None


async def update_verification_fields(guild_id: str, user_id: str, type_: str, social: str | None, method: str) -> None:
    await db.ready()
    await db.client.execute(
        "UPDATE verify_entries SET social = ?, method = ? WHERE guild_id = ? AND user_id = ? AND type = ?",
        [social, method, guild_id, user_id, type_],
    )
