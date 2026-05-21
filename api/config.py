import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _path(key: str, default: str) -> Path:
    return Path(os.getenv(key, default)).expanduser()


DB_PATH = _path("DB_PATH", "/storage/amstragram/amstramgram.db")
STORAGE_BASE = _path("STORAGE_BASE", "/storage/amstramgram")
PORT: int = int(os.getenv("PORT", "8000"))
DRY_RUN: bool = os.getenv("DRY_RUN", "").lower() in ("1", "true", "yes")
ENABLE_ACCESS_LOG: bool = os.getenv("ENABLE_ACCESS_LOG", "").lower() in (
    "1",
    "true",
    "yes",
)
