from typing import Optional

import discord
from discord import app_commands

from src.commands.verify import handlers


class VerifyGroup(app_commands.Group):
    def __init__(self):
        super().__init__(name="verify", description="User verification management")

    @app_commands.command(name="findom", description="[Admin] Verify a user as Findom")
    @app_commands.describe(
        user="User to verify", method="How the verification was done", social="Social media / handle (optional)"
    )
    async def findom(
        self, interaction: discord.Interaction, user: discord.Member, method: str, social: Optional[str] = None
    ) -> None:
        await handlers.handle_findom(interaction, user, method, social)

    @app_commands.command(name="sub", description="[Admin] Verify a user as Sub")
    @app_commands.describe(
        user="User to verify", method="How the verification was done", social="Social media / handle (optional)"
    )
    async def sub(
        self, interaction: discord.Interaction, user: discord.Member, method: str, social: Optional[str] = None
    ) -> None:
        await handlers.handle_sub(interaction, user, method, social)

    @app_commands.command(name="edit", description="[Admin] Edit an existing verification record")
    @app_commands.describe(
        user="Verified user",
        type="Which verification to edit",
        social="New Social value",
        method="New verification method",
    )
    @app_commands.choices(
        type=[
            discord.app_commands.Choice(name="Findom", value="findom"),
            discord.app_commands.Choice(name="Sub", value="sub"),
        ]
    )
    async def edit(
        self,
        interaction: discord.Interaction,
        user: discord.Member,
        type: discord.app_commands.Choice[str],
        social: Optional[str] = None,
        method: Optional[str] = None,
    ) -> None:
        await handlers.handle_edit(interaction, user, type.value, social, method)

    @app_commands.command(name="roles", description="[Admin] Set the roles assigned by /verify findom and /verify sub")
    @app_commands.describe(
        findom="Role to assign for Findom verification", sub="Role to assign for Sub verification"
    )
    async def roles(
        self, interaction: discord.Interaction, findom: Optional[discord.Role] = None, sub: Optional[discord.Role] = None
    ) -> None:
        await handlers.handle_roles(interaction, findom, sub)

    @app_commands.command(name="channel", description="[Admin] Set the channel where verification reports are posted")
    @app_commands.describe(channel="Channel for verification reports")
    async def channel(self, interaction: discord.Interaction, channel: discord.TextChannel) -> None:
        await handlers.handle_channel(interaction, channel)
