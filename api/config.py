import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _path(key: str, default: str) -> Path:
    return Path(os.getenv(key, default)).expanduser()


def _int(key: str, default: int) -> int:
    return int(os.getenv(key, str(default)))


STORAGE_BASE = _path("STORAGE_BASE", "/storage")
MEDIA_BASE = STORAGE_BASE / "media"
DB_PATH = STORAGE_BASE / "amstramgram.db"
LOG_PATH = STORAGE_BASE / "amstramgram.log"
PORT: int = _int("PORT", 8000)
DRY_RUN: bool = os.getenv("DRY_RUN", "").lower() in ("1", "true", "yes")
ENABLE_ACCESS_LOG: bool = os.getenv("ENABLE_ACCESS_LOG", "").lower() in (
    "1",
    "true",
    "yes",
)
TELEGRAM_BOT_TOKEN: str | None = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID: str | None = os.getenv("TELEGRAM_CHAT_ID")

# --- Scheduler tuning ---
# Accounts checked per cycle (fetch_new_posts picks a random count in this range).
SYNC_ACCOUNTS_PER_CYCLE_MIN: int = _int("SYNC_ACCOUNTS_PER_CYCLE_MIN", 5)
SYNC_ACCOUNTS_PER_CYCLE_MAX: int = _int("SYNC_ACCOUNTS_PER_CYCLE_MAX", 10)

# Max posts fetched for accounts not yet fully backfilled (to keep the feed fresh
# while fetch_old_posts handles the historical backfill separately).
SYNC_MAX_RECENT_POSTS: int = _int("SYNC_MAX_RECENT_POSTS", 5)

# Posts downloaded per account during historical backfill (fetch_old_posts).
SYNC_BACKFILL_MIN: int = _int("SYNC_BACKFILL_MIN", 30)
SYNC_BACKFILL_MAX: int = _int("SYNC_BACKFILL_MAX", 60)

# Delay between individual post downloads within an account (seconds).
SYNC_POST_DELAY_MIN: int = _int("SYNC_POST_DELAY_MIN", 10)
SYNC_POST_DELAY_MAX: int = _int("SYNC_POST_DELAY_MAX", 30)

# Delay between consecutive accounts within a group (seconds).
SYNC_ACCOUNT_DELAY_MIN: int = _int("SYNC_ACCOUNT_DELAY_MIN", 60)
SYNC_ACCOUNT_DELAY_MAX: int = _int("SYNC_ACCOUNT_DELAY_MAX", 180)

# Delay between groups of accounts (seconds).
SYNC_GROUP_DELAY_MIN: int = _int("SYNC_GROUP_DELAY_MIN", 600)
SYNC_GROUP_DELAY_MAX: int = _int("SYNC_GROUP_DELAY_MAX", 1200)

# Delay between accounts during historical backfill (seconds).
SYNC_BACKFILL_DELAY_MIN: int = _int("SYNC_BACKFILL_DELAY_MIN", 180)
SYNC_BACKFILL_DELAY_MAX: int = _int("SYNC_BACKFILL_DELAY_MAX", 360)

# Delay between full sync cycles after a successful run (seconds).
SYNC_CYCLE_DELAY_MIN: int = _int("SYNC_CYCLE_DELAY_MIN", 43200)   # 12 h
SYNC_CYCLE_DELAY_MAX: int = _int("SYNC_CYCLE_DELAY_MAX", 86400)   # 24 h

# Delay before the very first cycle after startup (seconds).
SYNC_INITIAL_DELAY_MIN: int = _int("SYNC_INITIAL_DELAY_MIN", 300)   # 5 min
SYNC_INITIAL_DELAY_MAX: int = _int("SYNC_INITIAL_DELAY_MAX", 1800)  # 30 min

# Enable historical backfill (fetch_old_posts). Disabled by default to reduce
# Instagram API volume — enable only once the session is stable.
SYNC_ENABLE_BACKFILL: bool = os.getenv("SYNC_ENABLE_BACKFILL", "").lower() in ("1", "true", "yes")

# Rate-limit handling.
SYNC_RATE_LIMIT_RETRIES: int = _int("SYNC_RATE_LIMIT_RETRIES", 2)
SYNC_RATE_LIMIT_BACKOFF_BASE: int = _int("SYNC_RATE_LIMIT_BACKOFF_BASE", 1800)   # 30 min
SYNC_RATE_LIMIT_BACKOFF_MAX: int = _int("SYNC_RATE_LIMIT_BACKOFF_MAX", 10800)    # 3 h
