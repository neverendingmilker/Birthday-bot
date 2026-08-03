import time
from typing import Optional

import discord

from src.features.verify import verify_manager
from src.utils.permissions import require_manage_roles

FINDOM_COLOR = 0xD4AF37  # gold
SUB_COLOR = 0x3498DB  # blue


async def _perform_verification(
    interaction: discord.Interaction,
    user: discord.Member,
    method: str,
    social: Optional[str],
    *,
    type_: str,
    role_id: Optional[str],
    title: str,
    color: int,
) -> None:
    """Runs the shared "verify someone" flow for either type ('findom' or 'sub')."""
    guild_config = await verify_manager.get_guild_config(str(interaction.guild_id))

    if not role_id:
        type_label = "Findom" if type_ == "findom" else "Sub"
        await interaction.response.send_message(
            content=f"⚠️ No {type_label} role is configured yet. An admin needs to run `/verify roles` first.",
            ephemeral=True,
        )
        return
    if not guild_config["verified_channel_id"]:
        await interaction.response.send_message(
            content="⚠️ No verification report channel is configured yet. An admin needs to run `/verify channel` first.",
            ephemeral=True,
        )
        return

    guild = interaction.guild
    try:
        member = guild.get_member(user.id) or await guild.fetch_member(user.id)
    except discord.HTTPException:
        member = None
    if not member:
        await interaction.response.send_message(content="⚠️ Couldn't find that user in this server.", ephemeral=True)
        return

    role = guild.get_role(int(role_id))
    bot_member = guild.me
    if not role:
        await interaction.response.send_message(
            content=f"⚠️ The configured {type_} role no longer exists. An admin needs to run `/verify roles` again.",
            ephemeral=True,
        )
        return
    if not bot_member or bot_member.top_role.position <= role.position:
        await interaction.response.send_message(
            content=f"⚠️ I can't assign {role.mention}: my role needs to be moved higher in the server's role list.",
            ephemeral=True,
        )
        return

    channel = guild.get_channel(int(guild_config["verified_channel_id"]))
    if not channel:
        await interaction.response.send_message(
            content="⚠️ The configured verification channel no longer exists. An admin needs to run `/verify channel` again.",
            ephemeral=True,
        )
        return

    await member.add_roles(role)

    verifier_name = interaction.user.display_name if isinstance(interaction.user, discord.Member) else interaction.user.name
    verified_at_seconds = int(time.time())

    embed = discord.Embed(color=color, title=title)
    embed.add_field(name="Member", value=f"<@{user.id}>", inline=False)
    embed.add_field(name="Social", value=social.strip() if social and social.strip() else "N/A", inline=False)
    embed.add_field(name="Verification", value=method, inline=False)
    embed.add_field(name="Verified on", value=f"<t:{verified_at_seconds}:F>", inline=False)
    embed.add_field(name="User ID", value=str(user.id), inline=False)
    embed.add_field(name="Verified by", value=verifier_name, inline=False)

    message = await channel.send(embed=embed)

    try:
        await verify_manager.record_verification(
            str(interaction.guild_id),
            str(user.id),
            type_,
            social,
            method,
            str(interaction.user.id),
            str(channel.id),
            str(message.id),
        )
    except verify_manager.ValidationError as err:
        await interaction.response.send_message(content=f"⚠️ {err}", ephemeral=True)
        return

    type_label = "Findom" if type_ == "findom" else "Sub"
    await interaction.response.send_message(content=f"✅ {user.mention} has been verified as {type_label}.", ephemeral=True)


async def handle_findom(interaction: discord.Interaction, user: discord.Member, method: str, social: Optional[str]) -> None:
    if not await require_manage_roles(interaction):
        return

    guild_config = await verify_manager.get_guild_config(str(interaction.guild_id))

    await _perform_verification(
        interaction,
        user,
        method,
        social,
        type_="findom",
        role_id=guild_config["findom_role_id"],
        title="✅ Findom Verification",
        color=FINDOM_COLOR,
    )


async def handle_sub(interaction: discord.Interaction, user: discord.Member, method: str, social: Optional[str]) -> None:
    if not await require_manage_roles(interaction):
        return

    guild_config = await verify_manager.get_guild_config(str(interaction.guild_id))

    await _perform_verification(
        interaction,
        user,
        method,
        social,
        type_="sub",
        role_id=guild_config["sub_role_id"],
        title="✅ Sub Verification",
        color=SUB_COLOR,
    )


async def handle_edit(
    interaction: discord.Interaction,
    user: discord.Member,
    type_: str,
    social: Optional[str],
    method: Optional[str],
) -> None:
    if not await require_manage_roles(interaction):
        return

    try:
        updated = await verify_manager.edit_verification(
            str(interaction.guild_id),
            str(user.id),
            type_,
            social if social is not None else verify_manager.NOT_PROVIDED,
            method if method is not None else verify_manager.NOT_PROVIDED,
        )
    except verify_manager.ValidationError as err:
        await interaction.response.send_message(content=f"⚠️ {err}", ephemeral=True)
        return

    note = ""

    if updated.get("channel_id") and updated.get("message_id"):
        channel = interaction.guild.get_channel(int(updated["channel_id"]))
        original_message = None
        if channel:
            try:
                original_message = await channel.fetch_message(int(updated["message_id"]))
            except discord.HTTPException:
                original_message = None

        if original_message and original_message.embeds:
            embed = original_message.embeds[0].copy()
            embed.set_field_at(1, name="Social", value=updated["social"] or "N/A", inline=False)
            embed.set_field_at(2, name="Verification", value=updated["method"], inline=False)
            await original_message.edit(embeds=[embed])
        else:
            note = "\n⚠️ Couldn't find the original report message to update it, but the record itself was updated."

    type_label = "Findom" if type_ == "findom" else "Sub"
    await interaction.response.send_message(
        content=f"✏️ {type_label} verification updated for {user.mention}.{note}", ephemeral=True
    )


async def handle_roles(
    interaction: discord.Interaction, findom: Optional[discord.Role], sub: Optional[discord.Role]
) -> None:
    if not await require_manage_roles(interaction):
        return

    if not findom and not sub:
        await interaction.response.send_message(
            content="⚠️ Provide at least one role to set (`findom` and/or `sub`).", ephemeral=True
        )
        return

    updates = []

    if findom:
        await verify_manager.set_findom_role(str(interaction.guild_id), str(findom.id))
        updates.append(f"Findom role set to {findom.mention}")
    if sub:
        await verify_manager.set_sub_role(str(interaction.guild_id), str(sub.id))
        updates.append(f"Sub role set to {sub.mention}")

    await interaction.response.send_message(content="✅ " + "\n✅ ".join(updates), ephemeral=True)


async def handle_channel(interaction: discord.Interaction, channel: discord.TextChannel) -> None:
    if not await require_manage_roles(interaction):
        return

    await verify_manager.set_verified_channel(str(interaction.guild_id), str(channel.id))

    message = f"✅ Verification reports will now be posted in {channel.mention}"

    bot_member = interaction.guild.me
    can_send = bot_member and channel.permissions_for(bot_member).send_messages
    if not can_send:
        message += (
            f'\n⚠️ Heads up: I don\'t currently have permission to send messages in {channel.mention}. '
            'Please grant me "Send Messages" there.'
        )

    await interaction.response.send_message(content=message, ephemeral=True)
