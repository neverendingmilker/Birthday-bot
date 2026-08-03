from typing import Callable

import discord

PAGE_TIMEOUT_SECONDS = 5 * 60  # 5 minutes of inactivity before the buttons stop working


class _PaginatorView(discord.ui.View):
    def __init__(self, owner_id: int, total_pages: int, build_embed: Callable[[int], discord.Embed]):
        super().__init__(timeout=PAGE_TIMEOUT_SECONDS)
        self.owner_id = owner_id
        self.total_pages = total_pages
        self.build_embed = build_embed
        self.page = 0
        self.message: discord.Message | None = None
        self._update_button_state()

    def _update_button_state(self) -> None:
        self.previous_button.disabled = self.page == 0
        self.next_button.disabled = self.page == self.total_pages - 1

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.owner_id:
            await interaction.response.send_message(
                "Only the person who ran the command can change pages.", ephemeral=True
            )
            return False
        return True

    @discord.ui.button(label="◀ Previous", style=discord.ButtonStyle.secondary)
    async def previous_button(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        self.page = max(0, self.page - 1)
        self._update_button_state()
        await interaction.response.edit_message(embed=self.build_embed(self.page), view=self)

    @discord.ui.button(label="Next ▶", style=discord.ButtonStyle.secondary)
    async def next_button(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        self.page = min(self.total_pages - 1, self.page + 1)
        self._update_button_state()
        await interaction.response.edit_message(embed=self.build_embed(self.page), view=self)

    async def on_timeout(self) -> None:
        if self.message is not None:
            try:
                await self.message.edit(view=None)
            except discord.HTTPException:
                pass


async def send_paginated(
    interaction: discord.Interaction, total_pages: int, build_embed: Callable[[int], discord.Embed]
) -> None:
    """Sends a reply as a paginated embed. build_embed(page_index) must return a discord.Embed
    for that page. If total_pages is 1, it's sent as a plain reply with no buttons."""
    if total_pages <= 1:
        await interaction.response.send_message(embed=build_embed(0))
        return

    view = _PaginatorView(interaction.user.id, total_pages, build_embed)
    await interaction.response.send_message(embed=build_embed(0), view=view)
    view.message = await interaction.original_response()
