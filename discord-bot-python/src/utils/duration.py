import re

UNIT_SECONDS = {"s": 1, "m": 60, "h": 3600, "d": 86400}
UNIT_LABELS = {"s": "seconds", "m": "minutes", "h": "hours", "d": "days"}

_DURATION_RE = re.compile(r"^(\d+)\s*(s|m|h|d)$", re.IGNORECASE)


def parse_duration_to_seconds(raw_input: str) -> int:
    """Parses strings like "10s", "5m", "24h", "3d" into a number of seconds."""
    match = _DURATION_RE.match(str(raw_input).strip())

    if not match:
        raise ValueError(
            "Invalid format. Use a number followed by s (seconds), m (minutes), h (hours) or d (days) "
            "— e.g. 30s, 10m, 24h, 3d."
        )

    amount = int(match.group(1))
    unit = match.group(2).lower()
    return amount * UNIT_SECONDS[unit]


def format_seconds(total_seconds: int) -> str:
    """Turns a number of seconds back into a compact, human-readable string, e.g. "1d 2h 5m"."""
    order = ["d", "h", "m", "s"]
    parts = []
    remaining = total_seconds

    for unit in order:
        size = UNIT_SECONDS[unit]
        if remaining >= size:
            value = remaining // size
            parts.append(f"{value}{unit}")
            remaining -= value * size

    return " ".join(parts) if parts else "0s"
