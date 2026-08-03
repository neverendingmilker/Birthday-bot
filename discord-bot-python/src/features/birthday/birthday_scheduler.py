import datetime
from zoneinfo import ZoneInfo

import discord
from discord.ext import tasks

from src import config
from src.features.birthday import birthday_repository as repo

MS_PER_SECOND = 1000


def _is_today(day: int, month: int, today: datetime.date | None = None) -> bool:
    if today is None:
        today = datetime.date.today()
    return day == today.day and month == today.month


async def _try_assign_role(client: discord.Client, guild_id: str, user_id: str, year: int, guild_config: dict) -> dict:
    """Assigns the birthday role to a single user, if a role is configured and it
    hasn't already been assigned to them this year."""
    if await repo.has_assignment_this_year(guild_id, user_id, year):
        return {"assigned": False, "reason": "already_assigned"}
    if not guild_config["birthday_role_id"]:
        return {"assigned": False, "reason": "no_role_configured"}

    guild = client.get_guild(int(guild_id))
    if not guild:
        return {"assigned": False, "reason": "guild_not_found"}

    try:
        member = guild.get_member(int(user_id)) or await guild.fetch_member(int(user_id))
    except discord.HTTPException:
        member = None
    if not member:
        return {"assigned": False, "reason": "member_not_found"}

    role = guild.get_role(int(guild_config["birthday_role_id"]))
    if not role:
        return {"assigned": False, "reason": "role_not_found"}

    bot_member = guild.me
    if not bot_member or bot_member.top_role.position <= role.position:
        return {"assigned": False, "reason": "role_too_high"}

    await member.add_roles(role)
    await repo.record_role_assignment(guild_id, user_id, _now_ms(), year)
    return {"assigned": True}


async def _try_send_greeting(client: discord.Client, guild_id: str, user_id: str, year: int, guild_config: dict) -> dict:
    """Posts a birthday greeting in the configured channel, if one is set and the
    user hasn't already been greeted this year."""
    if await repo.has_greeted_this_year(guild_id, user_id, year):
        return {"sent": False, "reason": "already_greeted"}
    if not guild_config["birthday_channel_id"]:
        return {"sent": False, "reason": "no_channel_configured"}

    guild = client.get_guild(int(guild_id))
    if not guild:
        return {"sent": False, "reason": "guild_not_found"}

    channel = guild.get_channel(int(guild_config["birthday_channel_id"]))
    if not channel:
        return {"sent": False, "reason": "channel_not_found"}

    bot_member = guild.me
    can_send = bot_member and channel.permissions_for(bot_member).send_messages
    if not can_send:
        return {"sent": False, "reason": "missing_permission"}

    await channel.send(f"🎉🎂 Happy birthday, <@{user_id}>! Have an amazing day! 🎂🎉")
    await repo.record_greeting(guild_id, user_id, year)
    return {"sent": True}


async def celebrate_birthday_if_due(client: discord.Client, guild_id: str, user_id: str, day: int, month: int) -> dict:
    """Combined check for a single user: assigns the role AND sends the greeting,
    independently of one another (a server can use either, both, or neither).
    Reusable both by the daily scheduler and by the slash commands directly, so
    things happen right away instead of waiting for next year's cron run when
    today's midnight check has already passed."""
    if not _is_today(day, month):
        return {"is_today": False}

    year = datetime.date.today().year
    guild_config = await repo.get_guild_config(guild_id)

    role_result = await _try_assign_role(client, guild_id, user_id, year, guild_config)
    greeting_result = await _try_send_greeting(client, guild_id, user_id, year, guild_config)

    return {"is_today": True, "role_result": role_result, "greeting_result": greeting_result}


async def celebrate_all_due_today(client: discord.Client) -> None:
    """Sweeps every birthday matching today's day/month, across all guilds the bot is in."""
    today = datetime.date.today()
    day, month = today.day, today.month

    celebrating = await repo.get_birthdays_for_today(day, month)

    for row in celebrating:
        guild_id, user_id = row["guild_id"], row["user_id"]
        try:
            result = await celebrate_birthday_if_due(client, guild_id, user_id, day, month)
            role_result = result.get("role_result") or {}
            if role_result.get("assigned"):
                print(f"[birthday] Assigned the role to {user_id} in guild {guild_id}")
            elif role_result.get("reason") == "role_too_high":
                print(
                    f"[birthday] Could not assign the role to {user_id} in guild {guild_id}: "
                    "the bot's role is not high enough in the hierarchy."
                )
            if (result.get("greeting_result") or {}).get("sent"):
                print(f"[birthday] Sent a greeting for {user_id} in guild {guild_id}")
        except Exception as err:  # noqa: BLE001
            print(f"[birthday] Error celebrating the birthday of {user_id} ({guild_id}): {err}")


async def celebrate_due_today_for_guild(client: discord.Client, guild_id: str) -> list[dict]:
    """Same as celebrate_all_due_today, but scoped to a single guild. Used right after
    an admin configures the birthday role or the greeting channel, in case someone's
    birthday is already today."""
    today = datetime.date.today()
    day, month = today.day, today.month

    celebrating = [row for row in await repo.get_birthdays_for_today(day, month) if row["guild_id"] == guild_id]

    results = []
    for row in celebrating:
        user_id = row["user_id"]
        result = await celebrate_birthday_if_due(client, guild_id, user_id, day, month)
        results.append({"user_id": user_id, **result})
    return results


async def _remove_expired_roles(client: discord.Client) -> None:
    assignments = await repo.get_all_active_assignments()
    now = _now_ms()

    for a in assignments:
        guild_id, user_id = a["guild_id"], a["user_id"]
        try:
            guild_config = await repo.get_guild_config(guild_id)
            expiry_ms = guild_config["remove_after_seconds"] * MS_PER_SECOND

            if now - a["assigned_at"] < expiry_ms:
                continue  # not due yet

            guild = client.get_guild(int(guild_id))
            if not guild:
                await repo.remove_role_assignment(guild_id, user_id)
                continue

            try:
                member = guild.get_member(int(user_id)) or await guild.fetch_member(int(user_id))
            except discord.HTTPException:
                member = None

            if member and guild_config["birthday_role_id"]:
                role = guild.get_role(int(guild_config["birthday_role_id"]))
                if role:
                    try:
                        await member.remove_roles(role)
                    except discord.HTTPException:
                        pass

            await repo.remove_role_assignment(guild_id, user_id)
            print(f"[birthday] Removed the role from {user_id} in guild {guild_id}")
        except Exception as err:  # noqa: BLE001
            print(f"[birthday] Error removing the role from {user_id} ({guild_id}): {err}")


def _now_ms() -> int:
    import time

    return int(time.time() * 1000)


def start(client: discord.Client) -> None:
    tz = ZoneInfo(config.TIMEZONE)

    # Every day at midnight, in the configured timezone: celebrate today's birthdays
    @tasks.loop(time=datetime.time(hour=0, minute=0, tzinfo=tz))
    async def _midnight_job():
        await celebrate_all_due_today(client)

    # Every 10 seconds: check whether any role assignment has expired. This fine-grained
    # interval matches the minimum removal timer allowed (10 seconds) via /birthday removerole.
    @tasks.loop(seconds=10)
    async def _expiry_job():
        await _remove_expired_roles(client)

    _midnight_job.start()
    # tasks.loop() with a plain interval (unlike the time-of-day loop above) runs its
    # first iteration immediately, so this alone covers the "also run once at startup"
    # behavior for the expiry check.
    _expiry_job.start()

    # Also run once at startup, useful if the bot was offline at midnight (the
    # time-of-day loop above only fires again at the next scheduled midnight).
    client.loop.create_task(celebrate_all_due_today(client))

    print("[birthday] Scheduler started.")
