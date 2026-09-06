import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import func

from database import SessionLocal
from models import GeminiUsage

logger = logging.getLogger("bhulekh.rate_limiter")


class GeminiRateLimitError(Exception):
    """Raised when the self-imposed daily Gemini API limit is exceeded."""
    pass


class GeminiOverloadError(Exception):
    """Raised when Gemini API returns 429 (quota/rate limit) or 503 (service unavailable/high demand)."""
    pass


def get_gemini_usage(target_date: Optional[str] = None) -> dict:
    """
    Returns today's daily count and current month's cumulative call count.
    Monthly count is dynamically computed via SUM(daily_count) WHERE month = X
    to prevent synchronization drift.
    """
    now = datetime.now()
    today_str = target_date or now.strftime("%Y-%m-%d")
    month_str = today_str[:7]  # "YYYY-MM"

    with SessionLocal() as db:
        today_row = db.query(GeminiUsage).filter_by(date=today_str).first()
        today_count = today_row.daily_count if today_row else 0

        month_total = (
            db.query(func.sum(GeminiUsage.daily_count))
            .filter(GeminiUsage.month == month_str)
            .scalar()
            or 0
        )

        return {
            "date": today_str,
            "month": month_str,
            "daily_count": int(today_count),
            "monthly_count": int(month_total),
        }


def check_gemini_rate_limit(limit: int = 50) -> int:
    """
    Checks if today's Gemini call count is under the limit (default 50).
    Resets at midnight automatically because the daily counter is keyed by calendar date (YYYY-MM-DD).
    Raises GeminiRateLimitError if today's count >= limit.
    """
    usage = get_gemini_usage()
    today_count = usage["daily_count"]

    if today_count >= limit:
        logger.warning(
            f"[Rate Limiter] Gemini daily demo limit reached ({today_count}/{limit} calls on {usage['date']})."
        )
        raise GeminiRateLimitError("Daily demo limit reached, please try again tomorrow")

    return today_count


def increment_gemini_usage() -> dict:
    """
    Increments the daily counter for today in SQLite.
    Returns updated usage stats dictionary.
    """
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    month_str = now.strftime("%Y-%m")

    with SessionLocal() as db:
        row = db.query(GeminiUsage).filter_by(date=today_str).first()
        if not row:
            row = GeminiUsage(
                date=today_str,
                month=month_str,
                daily_count=1,
            )
            db.add(row)
        else:
            row.daily_count += 1

        db.commit()
        db.refresh(row)

        # Compute updated month total
        month_total = (
            db.query(func.sum(GeminiUsage.daily_count))
            .filter(GeminiUsage.month == month_str)
            .scalar()
            or 0
        )

        logger.info(
            f"[Rate Limiter] Gemini call recorded: {row.daily_count} calls today ({today_str}), {month_total} this month ({month_str})."
        )

        return {
            "date": today_str,
            "month": month_str,
            "daily_count": int(row.daily_count),
            "monthly_count": int(month_total),
        }

