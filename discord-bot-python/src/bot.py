import discord
from discord import app_commands
from discord.ext import commands

from src.commands.animenight.group import AnimeNightGroup
from src.commands.birthday.group import BirthdayGroup
from src.commands.verify.group import VerifyGroup
from src.features.birthday import birthday_scheduler


def build_command_groups() -> list[app_commands.Group]:
    """One group per feature. Adding a new feature later just means creating a new
    group class and adding it here — same idea as the JS loadCommands() auto-loader."""
    return [BirthdayGroup(), AnimeNightGroup(), VerifyGroup()]


class DiscordBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.guilds = True
        intents.members = True  # needed to assign/remove roles and fetch members

        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self) -> None:
        # Registers every command group with the local tree so incoming interactions
        # can be routed. This does NOT push them to Discord's API — that's done by the
        # separate deploy_commands.py script (mirrors the JS "deploy then start" flow).
        for group in build_command_groups():
            self.tree.add_command(group)

    async def on_ready(self) -> None:
        print(f"✅ Bot online as {self.user}")

        # Every feature that needs periodic jobs registers itself here.
        # When adding new features in the future, just add a line here.
        birthday_scheduler.start(self)


async def on_tree_error(interaction: discord.Interaction, error: app_commands.AppCommandError) -> None:
    command_name = interaction.command.qualified_name if interaction.command else "?"

    if interaction.type == discord.InteractionType.autocomplete:
        print(f'Error in autocomplete for "{command_name}": {error}')
        return

    print(f'Error executing command "{command_name}": {error}')

    error_reply = {"content": "⚠️ An error occurred while executing this command.", "ephemeral": True}

    try:
        if interaction.response.is_done():
            await interaction.followup.send(**error_reply)
        else:
            await interaction.response.send_message(**error_reply)
    except discord.HTTPException:
        pass


def create_bot() -> DiscordBot:
    bot = DiscordBot()
    bot.tree.on_error = on_tree_error
    return bot
