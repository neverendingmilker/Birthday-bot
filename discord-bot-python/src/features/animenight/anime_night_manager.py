import re
from datetime import date, timedelta
from typing import Optional

from src.features.animenight import anime_night_repository as repo

_DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})(?:/(\d{4}))?$")


class ValidationError(Exception):
    pass


def _split_titles(raw_input: str) -> list[str]:
    """Splits "Naruto, One Piece / Bleach" into ["Naruto", "One Piece", "Bleach"]."""
    return [title.strip() for title in re.split(r"[,/]", raw_input) if title.strip()]


def _format_iso_date(d: date) -> str:
    return d.isoformat()


def format_display_date(iso_date: str) -> str:
    """Turns the ISO date stored in the DB (YYYY-MM-DD) back into DD/MM/YYYY for display."""
    yyyy, mm, dd = iso_date.split("-")
    return f"{dd}/{mm}/{yyyy}"


def _parse_watched_date(date_input: Optional[str]) -> str:
    """Accepts "DD/MM" or "DD/MM/YYYY", or the words "today"/"yesterday"; defaults to
    today if nothing is given at all."""
    if not date_input or not date_input.strip():
        return _format_iso_date(date.today())

    normalized = date_input.strip().lower()
    if normalized == "today":
        return _format_iso_date(date.today())
    if normalized == "yesterday":
        return _format_iso_date(date.today() - timedelta(days=1))

    match = _DATE_RE.match(date_input.strip())
    if not match:
        raise ValidationError(
            'Invalid date format. Use DD/MM, DD/MM/YYYY, "today" or "yesterday" — e.g. 23/10, 23/10/2026, today.'
        )

    day = int(match.group(1))
    month = int(match.group(2))
    year = int(match.group(3)) if match.group(3) else date.today().year

    try:
        parsed = date(year, month, day)
    except ValueError:
        raise ValidationError("Invalid date.") from None

    return _format_iso_date(parsed)


async def add_anime(guild_id: str, raw_titles: str, date_input: Optional[str], added_by: str) -> dict:
    titles = _split_titles(raw_titles)
    if not titles:
        raise ValidationError("No valid anime titles found. Separate multiple titles with a comma or a slash.")

    watched_date = _parse_watched_date(date_input)
    await repo.add_entries(guild_id, titles, watched_date, added_by)

    return {"titles": titles, "watched_date": watched_date}


async def get_sorted_list(guild_id: str, order: Optional[str]) -> list[dict]:
    """order: 'alphabetical' (default) or 'date' (most recently watched first)"""
    rows = await repo.get_all_entries(guild_id)

    if order == "date":
        # Most recently watched first; ties broken alphabetically by title.
        # Two-pass stable sort: sort by title first, then by date descending — Python's
        # sort is stable, so entries sharing a date keep their alphabetical order.
        by_title = sorted(rows, key=lambda r: r["title"])
        return sorted(by_title, key=lambda r: r["watched_date"], reverse=True)
    return sorted(rows, key=lambda r: r["title"])


async def get_last(guild_id: str, count: int) -> list[dict]:
    return await repo.get_last_entries(guild_id, count)


async def get_sessions_list(guild_id: str) -> list[dict]:
    """A "session" is every anime that shares the same watched_date (e.g. "Mystery Anime
    Night 3"). Session numbers are NOT stored: they're computed on the fly from the
    chronological order of distinct dates, so they always stay correct even if a
    session's date is later edited/moved."""
    rows = await repo.get_all_entries(guild_id)

    by_date: dict[str, list[str]] = {}
    for row in rows:
        by_date.setdefault(row["watched_date"], []).append(row["title"])

    sorted_dates = sorted(by_date.keys())  # ISO "YYYY-MM-DD" sorts chronologically as-is

    sessions = []
    for i, watched_date in enumerate(sorted_dates):
        titles = by_date[watched_date]
        sessions.append(
            {
                "number": i + 1,
                "date": watched_date,
                "titles": titles,
                "label": f"Mystery Anime Night {i + 1} — {format_display_date(watched_date)} ({len(titles)} anime)",
            }
        )
    return sessions


async def edit_session(
    guild_id: str,
    session_date: str,
    new_titles_raw: Optional[str],
    new_date_input: Optional[str],
    edited_by: str,
) -> dict:
    """Edits an existing session: replaces its anime list, moves it to a new date, or both.
    At least one of new_titles_raw / new_date_input must be given."""
    if not new_titles_raw and not new_date_input:
        raise ValidationError("Provide at least a new list of titles or a new date to change.")

    existing = await repo.get_entries_for_date(guild_id, session_date)
    if not existing:
        raise ValidationError("That session doesn't exist (it may have just been edited or removed).")

    final_date = _parse_watched_date(new_date_input) if new_date_input else session_date

    if new_titles_raw:
        titles = _split_titles(new_titles_raw)
        if not titles:
            raise ValidationError("No valid anime titles found. Separate multiple titles with a comma or a slash.")
        await repo.replace_session(guild_id, session_date, final_date, titles, edited_by)
        return {"titles": titles, "date": final_date}

    # Only the date is changing: keep the existing titles untouched.
    await repo.update_session_date(guild_id, session_date, final_date)
    return {"titles": [e["title"] for e in existing], "date": final_date}
