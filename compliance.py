"""Deterministic compliance engine — timezone-aware, FDCPA / Reg F compliant."""

from datetime import datetime, timedelta, time as dtime
from typing import Tuple


CONTACT_START = dtime(8, 0)   # 08:00 customer local time
CONTACT_END   = dtime(21, 0)  # 21:00 customer local time
MAX_DAILY_ATTEMPTS = 3


def check_compliance(customer: dict, utc_time_str: str | None = None) -> Tuple[bool, str]:
    """
    Timezone-aware compliance check.

    Converts the provided UTC time (or server UTC now if omitted) to the customer's
    local time using their utc_offset field, then checks against the 08:00–21:00 window.

    Args:
        customer:      Customer dict — must contain 'utc_offset' (float) and 'timezone' (str).
        utc_time_str:  Optional "HH:MM" UTC time string. Defaults to datetime.utcnow().

    Returns:
        (is_compliant: bool, reason: str)
    """
    if utc_time_str:
        try:
            parts = utc_time_str.strip().split(":")
            h, m = int(parts[0]), int(parts[1])
            utc_dt = datetime.utcnow().replace(hour=h, minute=m, second=0, microsecond=0)
        except (ValueError, IndexError):
            return False, f"Invalid time format '{utc_time_str}'. Expected HH:MM (24-hour UTC)."
    else:
        utc_dt = datetime.utcnow()

    # Apply customer's UTC offset (supports fractional offsets like +5.5 for India)
    utc_offset = customer.get("utc_offset", 0)
    offset_hours   = int(utc_offset)
    offset_minutes = round((abs(utc_offset) - abs(offset_hours)) * 60)
    if utc_offset < 0:
        offset_minutes = -offset_minutes

    local_dt   = utc_dt + timedelta(hours=offset_hours, minutes=offset_minutes)
    local_time = local_dt.time()
    tz_label   = customer.get("timezone", f"UTC{'+' if utc_offset >= 0 else ''}{utc_offset}")

    if local_time < CONTACT_START or local_time >= CONTACT_END:
        return (
            False,
            f"Contact blocked: {customer['name']}'s local time is "
            f"{local_time.strftime('%H:%M')} ({tz_label}), outside the permitted window "
            f"08:00–21:00 local (FDCPA / Reg F).",
        )

    return (
        True,
        f"Compliant: {customer['name']}'s local time is {local_time.strftime('%H:%M')} ({tz_label}).",
    )


def check_daily_limit(contact_attempts_today: int) -> Tuple[bool, str]:
    """Check whether the daily contact attempt limit has been reached."""
    if contact_attempts_today >= MAX_DAILY_ATTEMPTS:
        return (
            False,
            f"Contact blocked: customer has already been contacted "
            f"{contact_attempts_today} time(s) today (maximum {MAX_DAILY_ATTEMPTS} per day).",
        )
    return True, f"Daily attempt limit not reached ({contact_attempts_today}/{MAX_DAILY_ATTEMPTS})."
