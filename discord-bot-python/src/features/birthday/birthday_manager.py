from datetime import date
from typing import Optional

from src.features.birthday import birthday_repository as repo
from src.utils.duration import parse_duration_to_seconds

DAYS_PER_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]  # Feb allows the leap-year margin
MIN_REMOVE_AFTER_SECONDS = 10  # requested minimum: 10 seconds
MAX_REMOVE_AFTER_SECONDS = 30 * 86400  # 30 days


class ValidationError(Exception):
    pass


def _validate_date(day: int, month: int, year: Optional[int]) -> None:
    if month < 1 or month > 12:
        raise ValidationError("Month must be a number between 1 and 12.")
    if day < 1 or day > DAYS_PER_MONTH[month - 1]:
        raise ValidationError("Invalid day for the selected month.")
    if year is not None:
        current_year = date.today().year
        if year < 1900 or year > current_year:
            raise ValidationError("Invalid year.")


async def add_birthday(guild_id: str, user_id: str, day: int, month: int, year: Optional[int] = None) -> None:
    _validate_date(day, month, year)
    await repo.upsert_birthday(guild_id, user_id, day, month, year)


async def remove_birthday(guild_id: str, user_id: str) -> None:
    await repo.delete_birthday(guild_id, user_id)


async def get_birthday(guild_id: str, user_id: str) -> Optional[dict]:
    return await repo.get_birthday(guild_id, user_id)


async def set_birthday_role(guild_id: str, role_id: str) -> None:
    await repo.set_birthday_role(guild_id, role_id)


async def set_birthday_channel(guild_id: str, channel_id: str) -> None:
    await repo.set_birthday_channel(guild_id, channel_id)


async def set_remove_after_duration(guild_id: str, duration_input: str) -> None:
    """Accepts strings like "10s", "5m", "24h", "3d" (seconds/minutes/hours/days)."""
    try:
        seconds = parse_duration_to_seconds(duration_input)
    except ValueError as err:
        raise ValidationError(str(err)) from err

    if seconds < MIN_REMOVE_AFTER_SECONDS or seconds > MAX_REMOVE_AFTER_SECONDS:
        raise ValidationError("The timer must be between 10s and 30d.")

    await repo.set_remove_after_seconds(guild_id, seconds)


async def get_guild_config(guild_id: str) -> dict:
    return await repo.get_guild_config(guild_id)


MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _is_leap_year(year: int) -> bool:
    return (year % 4 == 0 and year % 100 != 0) or year % 400 == 0


def _next_occurrence(day: int, month: int, today: date) -> tuple[date, int]:
    """Computes the next date on which a birthday falls (today included) and how many
    days are left. February 29th, on non-leap years, is celebrated on the 28th."""

    def build_date(year: int) -> date:
        real_day = 28 if (month == 2 and day == 29 and not _is_leap_year(year)) else day
        return date(year, month, real_day)

    candidate = build_date(today.year)
    if candidate < today:
        candidate = build_date(today.year + 1)

    days_until = (candidate - today).days
    return candidate, days_until


async def get_upcoming_birthdays_grouped_by_month(guild_id: str, today: Optional[date] = None) -> list[dict]:
    """All birthdays in a guild, sorted by the soonest upcoming and grouped by month
    (the month of the NEXT occurrence, so the year rollover is handled correctly)."""
    if today is None:
        today = date.today()

    rows = await repo.get_all_birthdays_in_guild(guild_id)

    with_dates = []
    for row in rows:
        occurrence_date, days_until = _next_occurrence(row["day"], row["month"], today)
        with_dates.append({"user_id": row["user_id"], "date": occurrence_date, "days_until": days_until})
    with_dates.sort(key=lambda e: e["days_until"])

    groups: list[dict] = []
    current_key = None

    for entry in with_dates:
        key = (entry["date"].year, entry["date"].month)
        if key != current_key:
            groups.append({"month_label": MONTH_NAMES[entry["date"].month - 1], "entries": []})
            current_key = key
        groups[-1]["entries"].append(entry)

    return groups
