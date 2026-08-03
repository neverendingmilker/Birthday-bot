import time
from typing import Optional

from src.features.verify import verify_repository as repo

TYPES = ["findom", "sub"]

# Sentinel used by edit_verification to distinguish "this field wasn't provided, leave
# it unchanged" from "this field was explicitly provided" (which None alone can't do,
# since an explicitly-empty value is also represented as None after trimming).
NOT_PROVIDED = object()


class ValidationError(Exception):
    pass


async def get_guild_config(guild_id: str) -> dict:
    return await repo.get_guild_config(guild_id)


async def set_findom_role(guild_id: str, role_id: str) -> None:
    await repo.set_findom_role(guild_id, role_id)


async def set_sub_role(guild_id: str, role_id: str) -> None:
    await repo.set_sub_role(guild_id, role_id)


async def set_verified_channel(guild_id: str, channel_id: str) -> None:
    await repo.set_verified_channel(guild_id, channel_id)


async def record_verification(
    guild_id: str,
    user_id: str,
    type_: str,
    social_input: Optional[str],
    method_input: Optional[str],
    verified_by: str,
    channel_id: Optional[str],
    message_id: Optional[str],
) -> dict:
    """Records (or overwrites, if the user is re-verified) a verification entry."""
    if type_ not in TYPES:
        raise ValidationError("Invalid verification type.")
    if not method_input or not method_input.strip():
        raise ValidationError("Method is required.")

    social = social_input.strip() if social_input and social_input.strip() else None
    method = method_input.strip()

    await repo.upsert_verification(
        guild_id, user_id, type_, social, method, int(time.time() * 1000), verified_by, channel_id, message_id
    )

    return {"social": social, "method": method}


async def get_verification(guild_id: str, user_id: str, type_: str) -> Optional[dict]:
    return await repo.get_verification(guild_id, user_id, type_)


async def edit_verification(guild_id: str, user_id: str, type_: str, social_input=NOT_PROVIDED, method_input=NOT_PROVIDED) -> dict:
    """Edits an existing verification's Social and/or Method. At least one must be
    provided (pass NOT_PROVIDED for a field that shouldn't change)."""
    if social_input is NOT_PROVIDED and method_input is NOT_PROVIDED:
        raise ValidationError("Provide at least a new Social or Method value to change.")
    if method_input is not NOT_PROVIDED and not (method_input or "").strip():
        raise ValidationError("Method cannot be empty.")

    existing = await repo.get_verification(guild_id, user_id, type_)
    if not existing:
        raise ValidationError("No existing verification found for that user and type.")

    if social_input is not NOT_PROVIDED:
        new_social = social_input.strip() if social_input and social_input.strip() else None
    else:
        new_social = existing["social"]

    new_method = method_input.strip() if method_input is not NOT_PROVIDED else existing["method"]

    await repo.update_verification_fields(guild_id, user_id, type_, new_social, new_method)

    return {**existing, "social": new_social, "method": new_method}
