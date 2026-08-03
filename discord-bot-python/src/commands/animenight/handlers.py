from typing import Optional

import discord

from src.features.animenight import anime_night_manager
from src.utils.pagination import send_paginated

EMBED_COLOR = 0x8E6FFF
SESSIONS_PER_PAGE = 10
ENTRIES_PER_PAGE = 15
MAX_FIELD_LENGTH = 1024  # Discord's limit for an embed field value


def _truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return f"{text[:max_len - 1]}…"


async def handle_add(interaction: discord.Interaction, titles: str, date: Optional[str]) -> None:
    if not interaction.permissions.manage_roles:
        await interaction.response.send_message(
            '❌ You need the "Manage Roles" permission to use this command.', ephemeral=True
        )
        return

    try:
        result = await anime_night_manager.add_anime(
            str(interaction.guild_id), titles, date, str(interaction.user.id)
        )
    except anime_night_manager.ValidationError as err:
        await interaction.response.send_message(content=f"⚠️ {err}", ephemeral=True)
        return

    display_date = anime_night_manager.format_display_date(result["watched_date"])
    listing = "\n".join(f"• {title}" for title in result["titles"])

    await interaction.response.send_message(
        content=f"📺 Added {len(result['titles'])} anime for **{display_date}**:\n{listing}"
    )


async def handle_edit(
    interaction: discord.Interaction, session: str, titles: Optional[str], date: Optional[str]
) -> None:
    if not interaction.permissions.manage_roles:
        await interaction.response.send_message(
            '❌ You need the "Manage Roles" permission to use this command.', ephemeral=True
        )
        return

    try:
        result = await anime_night_manager.edit_session(
            str(interaction.guild_id), session, titles, date, str(interaction.user.id)
        )
    except anime_night_manager.ValidationError as err:
        await interaction.response.send_message(content=f"⚠️ {err}", ephemeral=True)
        return

    # Recompute the session number after the edit, for a friendly confirmation message.
    sessions = await anime_night_manager.get_sessions_list(str(interaction.guild_id))
    matched = next((s for s in sessions if s["date"] == result["date"]), None)
    label = f"Mystery Anime Night {matched['number']}" if matched else "Session"

    listing = "\n".join(f"• {title}" for title in result["titles"])
    await interaction.response.send_message(
        content=(
            f"✏️ {label} updated — now on **{anime_night_manager.format_display_date(result['date'])}**:\n{listing}"
        )
    )


async def handle_last(interaction: discord.Interaction) -> None:
    sessions = await anime_night_manager.get_sessions_list(str(interaction.guild_id))

    if not sessions:
        await interaction.response.send_message(
            content="📺 No anime logged yet for Mystery Anime Night. Use `/animenight add` to start the list!",
            ephemeral=True,
        )
        return

    # Sessions are sorted chronologically ascending, so the last one is the most recent.
    last_session = sessions[-1]
    titles = last_session["titles"]
    total_pages = -(-len(titles) // ENTRIES_PER_PAGE)  # ceil division

    def build_embed(page: int) -> discord.Embed:
        start = page * ENTRIES_PER_PAGE
        page_titles = titles[start : start + ENTRIES_PER_PAGE]
        lines = [f"{start + i + 1}. {title}" for i, title in enumerate(page_titles)]

        embed = discord.Embed(color=EMBED_COLOR, title=f"📺 {last_session['label']}", description="\n".join(lines))
        embed.set_footer(text=f"page {page + 1}/{total_pages}")
        return embed

    await send_paginated(interaction, total_pages, build_embed)


async def handle_list(interaction: discord.Interaction, order: Optional[str]) -> None:
    order = order or "alphabetical"
    sessions = await anime_night_manager.get_sessions_list(str(interaction.guild_id))

    if not sessions:
        await interaction.response.send_message(
            content="📺 No anime logged yet for Mystery Anime Night. Use `/animenight add` to start the list!",
            ephemeral=True,
        )
        return

    # Sessions themselves always stay in chronological order (that's what "session number"
    # means); "order" only controls how titles are sorted WITHIN each session.
    display_sessions = [
        {**s, "titles": sorted(s["titles"]) if order == "alphabetical" else s["titles"]} for s in sessions
    ]

    total_anime = sum(len(s["titles"]) for s in sessions)
    total_pages = -(-len(display_sessions) // SESSIONS_PER_PAGE)  # ceil division

    def build_embed(page: int) -> discord.Embed:
        start = page * SESSIONS_PER_PAGE
        page_sessions = display_sessions[start : start + SESSIONS_PER_PAGE]

        embed = discord.Embed(color=EMBED_COLOR, title=f"📺 Mystery Anime Night — {interaction.guild.name}")
        embed.set_footer(
            text=f"{len(sessions)} session(s) • {total_anime} anime logged • page {page + 1}/{total_pages}"
        )

        for session in page_sessions:
            value = "\n".join(f"• {title}" for title in session["titles"])
            embed.add_field(
                name=(
                    f"Mystery Anime Night {session['number']} — "
                    f"{anime_night_manager.format_display_date(session['date'])}"
                ),
                value=_truncate(value, MAX_FIELD_LENGTH),
                inline=False,
            )

        return embed

    await send_paginated(interaction, total_pages, build_embed)


async def session_autocomplete(
    interaction: discord.Interaction, current: str
) -> list[discord.app_commands.Choice[str]]:
    """Powers the "session" option's autocomplete on /animenight edit: as the admin types,
    suggest matching sessions (e.g. "Mystery Anime Night 3 — 23/10/2026 (5 anime)")."""
    sessions = await anime_night_manager.get_sessions_list(str(interaction.guild_id))
    query = current.lower()

    filtered = [s for s in sessions if query in s["label"].lower()]
    filtered = filtered[-25:]  # Discord allows at most 25 suggestions
    filtered.reverse()  # show the most recent sessions first

    return [discord.app_commands.Choice(name=s["label"], value=s["date"]) for s in filtered]
