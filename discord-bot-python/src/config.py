import os

from dotenv import load_dotenv

load_dotenv()

TOKEN = os.environ.get("DISCORD_TOKEN")
CLIENT_ID = os.environ.get("CLIENT_ID")
GUILD_ID = os.environ.get("GUILD_ID") or None
TIMEZONE = os.environ.get("TZ", "Europe/Rome")
PORT = int(os.environ.get("PORT", "3000"))

TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")
