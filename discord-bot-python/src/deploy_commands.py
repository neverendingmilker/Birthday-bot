import asyncio
import sys

import discord

from src import config
from src.bot import DiscordBot, build_command_groups


async def deploy() -> None:
    if not config.TOKEN or not config.CLIENT_ID:
        print("❌ DISCORD_TOKEN and CLIENT_ID must be set in the .env file", file=sys.stderr)
        sys.exit(1)

    bot = DiscordBot()

    for group in build_command_groups():
        bot.tree.add_command(group)

    count = len(bot.tree.get_commands())

    async with bot:
        await bot.login(config.TOKEN)

        if config.GUILD_ID:
            guild = discord.Object(id=int(config.GUILD_ID))
            print(f"Registering {count} command(s) on guild {config.GUILD_ID} (instant)...")
            bot.tree.copy_global_to(guild=guild)
            await bot.tree.sync(guild=guild)
        else:
            print(f"Registering {count} command(s) globally (can take up to 1h to propagate)...")
            await bot.tree.sync()

        print("✅ Commands registered successfully.")


if __name__ == "__main__":
    try:
        asyncio.run(deploy())
    except Exception as err:  # noqa: BLE001
        print(f"❌ Error registering commands: {err}", file=sys.stderr)
        sys.exit(1)
