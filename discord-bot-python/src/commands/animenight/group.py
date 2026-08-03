from typing import Literal, Optional

import discord
from discord import app_commands

from src.commands.animenight import handlers


class AnimeNightGroup(app_commands.Group):
    def __init__(self):
        super().__init__(name="animenight", description="Mystery Anime Night watch list")

    @app_commands.command(name="add", description="[Admin] Add one or more anime to the watched list")
    @app_commands.describe(
        titles='Anime title(s). Separate multiple with a comma or a slash, e.g. "Naruto, Bleach"',
        date='Date watched: DD/MM, DD/MM/YYYY, "today" or "yesterday" (default: today)',
    )
    async def add(self, interaction: discord.Interaction, titles: str, date: Optional[str] = None) -> None:
        await handlers.handle_add(interaction, titles, date)

    @app_commands.command(name="list", description="Show the full watched anime list")
    @app_commands.describe(order="How to sort titles within each session (default: alphabetical)")
    @app_commands.choices(
        order=[
            discord.app_commands.Choice(name="Alphabetical", value="alphabetical"),
            discord.app_commands.Choice(name="Order added", value="added"),
        ]
    )
    async def list_(
        self, interaction: discord.Interaction, order: Optional[app_commands.Choice[str]] = None
    ) -> None:
        await handlers.handle_list(interaction, order.value if order else None)

    @app_commands.command(
        name="last", description="Show the anime from the most recent Mystery Anime Night session"
    )
    async def last(self, interaction: discord.Interaction) -> None:
        await handlers.handle_last(interaction)

    @app_commands.command(name="edit", description="[Admin] Edit an existing Mystery Anime Night session")
    @app_commands.describe(
        session="Which session to edit (start typing to search)",
        titles="New anime list for this session, replaces the old one. Separate with , or /",
        date='New date for this session: DD/MM, DD/MM/YYYY, "today" or "yesterday"',
    )
    @app_commands.autocomplete(session=handlers.session_autocomplete)
    async def edit(
        self,
        interaction: discord.Interaction,
        session: str,
        titles: Optional[str] = None,
        date: Optional[str] = None,
    ) -> None:
        await handlers.handle_edit(interaction, session, titles, date)
