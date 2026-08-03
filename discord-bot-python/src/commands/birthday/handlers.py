from datetime import date
from typing import Optional

import discord

from src.features.birthday import birthday_manager
from src.features.birthday import birthday_scheduler
from src.utils.duration import format_seconds
from src.utils.permissions import require_manage_roles

EMBED_COLOR = 0xFF6FA5
MAX_FIELD_LENGTH = 1024  # Discord's limit for an embed field value


async def handle_add(
    interaction: discord.Interaction,
    day: int,
    month: int,
    year: Optional[int],
    user: Optional[discord.Member],
) -> None:
    is_for_someone_else = user is not None and user.id != interaction.user.id

    if is_for_someone_else and not interaction.permissions.manage_roles:
        await interaction.response.send_message(
            '❌ You need the "Manage Roles" permission to set someone else\'s birthday.', ephemeral=True
        )
        return

    target = user or interaction.user

    try:
        await birthday_manager.add_birthday(str(interaction.guild_id), str(target.id), day, month, year)
    except birthday_manager.ValidationError as err:
        await interaction.response.send_message(content=f"⚠️ {err}", ephemeral=True)
        return

    date_str = f"{day}/{month}/{year}" if year else f"{day}/{month}"
    message = (
        f"🎂 Birthday saved for {target.mention}: **{date_str}**"
        if is_for_someone_else
        else f"🎂 Birthday saved: **{date_str}**"
    )

    # If today happens to be the birthday just saved, celebrate it right away
    # instead of waiting for tonight's midnight check (which has already run today).
    result = await birthday_scheduler.celebrate_birthday_if_due(
        interaction.client, str(interaction.guild_id), str(target.id), day, month
    )

    if result.get("is_today"):
        role_result = result.get("role_result") or {}
        if role_result.get("assigned"):
            message += (
                "\n🎉 It's their birthday today — I've given them the birthday role!"
                if is_for_someone_else
                else "\n🎉 It's your birthday today — I've given you the birthday role!"
            )
        elif role_result.get("reason") == "role_too_high":
            message += (
                "\n⚠️ Today is the birthday, but I couldn't assign the role: my role needs to be "
                "moved higher in the server's role list."
            )

    await interaction.response.send_message(content=message, ephemeral=True)


async def handle_role(interaction: discord.Interaction, role: discord.Role) -> None:
    if not await require_manage_roles(interaction):
        return

    await birthday_manager.set_birthday_role(str(interaction.guild_id), str(role.id))

    message = f"✅ The birthday role has been set to {role.mention}"

    bot_member = interaction.guild.me
    if bot_member and bot_member.top_role.position <= role.position:
        message += (
            f"\n⚠️ Heads up: my own role is currently **not** higher than {role.mention} in the "
            "server's role list, so I won't actually be able to assign or remove it. "
            "Please move my role above it in Server Settings → Roles."
        )
    else:
        # Hierarchy looks fine: check if anyone is already celebrating today and assign right away,
        # in case the role wasn't configured yet when their birthday check ran this morning.
        results = await birthday_scheduler.celebrate_due_today_for_guild(interaction.client, str(interaction.guild_id))
        assigned_count = sum(1 for r in results if (r.get("role_result") or {}).get("assigned"))
        if assigned_count > 0:
            message += f"\n🎉 Also assigned it right away to {assigned_count} member(s) celebrating today."

    await interaction.response.send_message(content=message, ephemeral=True)


async def handle_remove_role(interaction: discord.Interaction, timer: str) -> None:
    if not await require_manage_roles(interaction):
        return

    try:
        await birthday_manager.set_remove_after_duration(str(interaction.guild_id), timer)
    except birthday_manager.ValidationError as err:
        await interaction.response.send_message(content=f"⚠️ {err}", ephemeral=True)
        return

    guild_config = await birthday_manager.get_guild_config(str(interaction.guild_id))
    await interaction.response.send_message(
        content=f"✅ The birthday role will now be removed after **{format_seconds(guild_config['remove_after_seconds'])}**.",
        ephemeral=True,
    )


async def handle_channel(interaction: discord.Interaction, channel: discord.TextChannel) -> None:
    if not await require_manage_roles(interaction):
        return

    await birthday_manager.set_birthday_channel(str(interaction.guild_id), str(channel.id))

    message = f"✅ Birthday greetings will now be posted in {channel.mention}"

    bot_member = interaction.guild.me
    can_send = bot_member and channel.permissions_for(bot_member).send_messages

    if not can_send:
        message += (
            f'\n⚠️ Heads up: I don\'t currently have permission to send messages in {channel.mention}. '
            'Please grant me "Send Messages" there.'
        )
    else:
        # Check if anyone is already celebrating today and greet them right away,
        # in case the channel wasn't configured yet when their birthday check ran this morning.
        results = await birthday_scheduler.celebrate_due_today_for_guild(interaction.client, str(interaction.guild_id))
        greeted_count = sum(1 for r in results if (r.get("greeting_result") or {}).get("sent"))
        if greeted_count > 0:
            message += f"\n🎉 Also sent a birthday greeting right away for {greeted_count} member(s) celebrating today."

    await interaction.response.send_message(content=message, ephemeral=True)


def _format_date(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def _format_days_left(days_until: int) -> str:
    if days_until == 0:
        return "today! 🎉"
    if days_until == 1:
        return "tomorrow"
    return f"in {days_until} days"


def _truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return f"{text[:max_len - 1]}…"


async def handle_list(interaction: discord.Interaction) -> None:
    groups = await birthday_manager.get_upcoming_birthdays_grouped_by_month(str(interaction.guild_id))

    if not groups:
        await interaction.response.send_message(
            content="🎂 No birthdays saved yet in this server. Use `/birthday add` to add yours!", ephemeral=True
        )
        return

    embed = discord.Embed(color=EMBED_COLOR, title=f"🎂 Upcoming birthdays — {interaction.guild.name}")
    embed.set_footer(text=f"Requested by {interaction.user.name}", icon_url=interaction.user.display_avatar.url)

    guild_icon = interaction.guild.icon
    if guild_icon:
        embed.set_thumbnail(url=guild_icon.url)

    for group in groups:
        lines = [
            f"{i + 1}. {_format_date(e['date'])} - <@{e['user_id']}> - {_format_days_left(e['days_until'])}"
            for i, e in enumerate(group["entries"])
        ]
        embed.add_field(name=group["month_label"], value=_truncate("\n".join(lines), MAX_FIELD_LENGTH), inline=False)

    await interaction.response.send_message(embed=embed)
