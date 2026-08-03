import asyncio
import sys

from src import config, health
from src.bot import create_bot


async def main() -> None:
    if not config.TOKEN or not config.CLIENT_ID:
        print("❌ DISCORD_TOKEN and CLIENT_ID must be set in the .env file", file=sys.stderr)
        sys.exit(1)

    bot = create_bot()

    async with bot:
        # No dashboard: just a small status page, to satisfy Render's requirement
        # (hosting configured as a "Web Service") of having an open HTTP port.
        await health.start(bot)
        await bot.start(config.TOKEN)


if __name__ == "__main__":
    asyncio.run(main())
