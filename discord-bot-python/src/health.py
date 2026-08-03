"""Render (or similar hosting configured as a "Web Service") requires the process to
respond on an HTTP port, otherwise it's considered "unhealthy". This is NOT a
dashboard: it's just a status page, using aiohttp (already a discord.py dependency,
so no extra package is needed). It's also handy as a target for an external ping
(e.g. cron-job.org) to prevent the free plan from going to sleep due to inactivity.
"""
from aiohttp import web

from src import config


async def start(client) -> web.AppRunner:
    async def handler(request: web.Request) -> web.Response:
        if client.is_ready():
            text = f"OK - Bot online as {client.user}"
        else:
            text = "OK - Bot starting..."
        return web.Response(text=text, content_type="text/plain", charset="utf-8")

    app = web.Application()
    app.router.add_get("/", handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", config.PORT)
    await site.start()

    print(f"[health] Status server listening on port {config.PORT}")
    return runner
