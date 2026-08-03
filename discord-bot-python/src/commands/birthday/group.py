from typing import Optional

import discord
from discord import app_commands

from src.commands.birthday import handlers


class BirthdayGroup(app_commands.Group):
    def __init__(self):
        super().__init__(name="birthday", description="Birthday management")

    @app_commands.command(name="add", description="Add (or update) your birthday")
    @app_commands.describe(
        day="Day (1-31)",
        month="Month (1-12)",
        year="Year of birth (optional)",
        user="[Admin only] Set the birthday for someone else instead of yourself",
    )
    async def add(
        self,
        interaction: discord.Interaction,
        day: app_commands.Range[int, 1, 31],
        month: app_commands.Range[int, 1, 12],
        year: Optional[int] = None,
        user: Optional[discord.Member] = None,
    ) -> None:
        await handlers.handle_add(interaction, day, month, year, user)

    @app_commands.command(name="role", description="[Admin] Set the role to assign on someone's birthday")
    @app_commands.describe(role="Role to assign")
    async def role(self, interaction: discord.Interaction, role: discord.Role) -> None:
        await handlers.handle_role(interaction, role)

    @app_commands.command(name="removerole", description="[Admin] Set after how long to remove the birthday role")
    @app_commands.describe(timer="e.g. 30s, 10m, 24h, 3d (min 10s, max 30d, default 24h)")
    async def removerole(self, interaction: discord.Interaction, timer: str) -> None:
        await handlers.handle_remove_role(interaction, timer)

    @app_commands.command(
        name="channel", description="[Admin] Set the channel where automatic birthday greetings are posted"
    )
    @app_commands.describe(channel="Channel for birthday greetings")
    async def channel(self, interaction: discord.Interaction, channel: discord.TextChannel) -> None:
        await handlers.handle_channel(interaction, channel)

    @app_commands.command(name="list", description="Show all birthdays in this server, grouped by month")
    async def list_(self, interaction: discord.Interaction) -> None:
        await handlers.handle_list(interaction)
