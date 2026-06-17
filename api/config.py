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
IMPORT_ACCOUNTS_PER_CYCLE_MIN: int = _int("IMPORT_ACCOUNTS_PER_CYCLE_MIN", 5)
IMPORT_ACCOUNTS_PER_CYCLE_MAX: int = _int("IMPORT_ACCOUNTS_PER_CYCLE_MAX", 10)

# Max posts fetched for accounts not yet fully backfilled (to keep the feed fresh
# while fetch_old_posts handles the historical backfill separately).
IMPORT_MAX_RECENT_POSTS: int = _int("IMPORT_MAX_RECENT_POSTS", 5)

# Posts downloaded per account during historical backfill (fetch_old_posts).
IMPORT_BACKFILL_MIN: int = _int("IMPORT_BACKFILL_MIN", 30)
IMPORT_BACKFILL_MAX: int = _int("IMPORT_BACKFILL_MAX", 60)

# Delay between individual post downloads within an account (seconds).
IMPORT_POST_DELAY_MIN: int = _int("IMPORT_POST_DELAY_MIN", 10)
IMPORT_POST_DELAY_MAX: int = _int("IMPORT_POST_DELAY_MAX", 30)

# Delay between consecutive accounts within a group (seconds).
IMPORT_ACCOUNT_DELAY_MIN: int = _int("IMPORT_ACCOUNT_DELAY_MIN", 60)
IMPORT_ACCOUNT_DELAY_MAX: int = _int("IMPORT_ACCOUNT_DELAY_MAX", 180)

# Delay between groups of accounts (seconds).
IMPORT_GROUP_DELAY_MIN: int = _int("IMPORT_GROUP_DELAY_MIN", 600)
IMPORT_GROUP_DELAY_MAX: int = _int("IMPORT_GROUP_DELAY_MAX", 1200)

# Delay between accounts during historical backfill (seconds).
IMPORT_BACKFILL_DELAY_MIN: int = _int("IMPORT_BACKFILL_DELAY_MIN", 180)
IMPORT_BACKFILL_DELAY_MAX: int = _int("IMPORT_BACKFILL_DELAY_MAX", 360)

# Delay between full import cycles after a successful run (seconds).
IMPORT_CYCLE_DELAY_MIN: int = _int("IMPORT_CYCLE_DELAY_MIN", 43200)   # 12 h
IMPORT_CYCLE_DELAY_MAX: int = _int("IMPORT_CYCLE_DELAY_MAX", 86400)   # 24 h

# Delay before the very first cycle after startup (seconds).
IMPORT_INITIAL_DELAY_MIN: int = _int("IMPORT_INITIAL_DELAY_MIN", 300)   # 5 min
IMPORT_INITIAL_DELAY_MAX: int = _int("IMPORT_INITIAL_DELAY_MAX", 1800)  # 30 min

# Jitter added after the overnight pause before starting the first daytime cycle (seconds).
IMPORT_MORNING_JITTER_MIN: int = _int("IMPORT_MORNING_JITTER_MIN", 300)    # 5 min
IMPORT_MORNING_JITTER_MAX: int = _int("IMPORT_MORNING_JITTER_MAX", 7200)   # 2 h

# Enable historical backfill (fetch_old_posts). Disabled by default to reduce
# Instagram API volume — enable only once the session is stable.
IMPORT_ENABLE_BACKFILL: bool = os.getenv("IMPORT_ENABLE_BACKFILL", "").lower() in ("1", "true", "yes")

# Rate-limit handling.
IMPORT_RATE_LIMIT_RETRIES: int = _int("IMPORT_RATE_LIMIT_RETRIES", 2)
IMPORT_RATE_LIMIT_BACKOFF_BASE: int = _int("IMPORT_RATE_LIMIT_BACKOFF_BASE", 1800)   # 30 min
IMPORT_RATE_LIMIT_BACKOFF_MAX: int = _int("IMPORT_RATE_LIMIT_BACKOFF_MAX", 10800)    # 3 h
