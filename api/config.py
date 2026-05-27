import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _path(key: str, default: str) -> Path:
    return Path(os.getenv(key, default)).expanduser()


STORAGE_BASE = _path("STORAGE_BASE", "/storage")
MEDIA_BASE = STORAGE_BASE / "media"
DB_PATH = STORAGE_BASE / "amstramgram.db"
LOG_PATH = STORAGE_BASE / "amstramgram.log"
PORT: int = int(os.getenv("PORT", "8000"))
DRY_RUN: bool = os.getenv("DRY_RUN", "").lower() in ("1", "true", "yes")
ENABLE_ACCESS_LOG: bool = os.getenv("ENABLE_ACCESS_LOG", "").lower() in (
    "1",
    "true",
    "yes",
)
TELEGRAM_BOT_TOKEN: str | None = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID: str | None = os.getenv("TELEGRAM_CHAT_ID")
