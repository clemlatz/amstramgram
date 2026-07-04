import asyncio
import logging
from pathlib import Path

from .db import MEDIA_EXTS, import_gramoire_file

logger = logging.getLogger(__name__)

# Shared across the manual (settings) and automatic (userscript) import-from-disk
# entry points so only one disk import runs at a time.
import_from_disk_lock = asyncio.Lock()


def count_pending_imports(storage_base: Path) -> int:
    imports_dir = storage_base / "imports"
    if not imports_dir.exists():
        return 0
    return sum(
        1
        for f in imports_dir.iterdir()
        if f.is_file()
        and f.suffix.lower() in MEDIA_EXTS
        and f.with_suffix(".json").exists()
    )


def run_import(db_path: Path, storage_base: Path) -> dict:
    imports_dir = storage_base / "imports"
    if not imports_dir.exists():
        return {"imported": 0, "duplicates": 0, "warnings": 0}

    media_files = [
        f
        for f in imports_dir.iterdir()
        if f.is_file() and f.suffix.lower() in MEDIA_EXTS
    ]

    imported = duplicates = warnings = 0

    for media in sorted(media_files):
        json_path = media.with_suffix(".json")
        if not json_path.exists():
            logger.warning("no sidecar for %s, skipping", media.name)
            warnings += 1
            continue

        try:
            result = import_gramoire_file(media, json_path, storage_base, db_path)
        except Exception as exc:
            logger.warning("failed to import %s: %s, skipping", media.name, exc)
            warnings += 1
            continue

        if result == "duplicate":
            logger.info("duplicate: %s", media.name)
            duplicates += 1
        else:
            logger.info("imported: %s", media.name)
            imported += 1
        json_path.unlink(missing_ok=True)
        media.unlink(missing_ok=True)

    return {"imported": imported, "duplicates": duplicates, "warnings": warnings}
