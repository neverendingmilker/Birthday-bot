import discord


async def require_manage_roles(interaction: discord.Interaction) -> bool:
    """Returns True if the invoking member has the "Manage Roles" permission; otherwise
    replies with the same ephemeral error message used throughout the bot and returns False."""
    permissions = interaction.permissions
    if not permissions.manage_roles:
        await interaction.response.send_message(
            '❌ You need the "Manage Roles" permission to use this command.', ephemeral=True
        )
        return False
    return True
