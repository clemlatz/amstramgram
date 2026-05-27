#!/usr/bin/env python3
"""Import media files and Gramoire JSON sidecars from STORAGE_BASE/imports/."""

import argparse
import sys
from pathlib import Path

from api.db import MEDIA_EXTS, import_gramoire_file, init_db


def run_import(db_path: Path, storage_base: Path, dry_run: bool) -> None:
    imports_dir = storage_base / "imports"
    if not imports_dir.exists():
        print(f"Imports directory not found: {imports_dir}")
        return

    media_files = [
        f
        for f in imports_dir.iterdir()
        if f.is_file() and f.suffix.lower() in MEDIA_EXTS
    ]

    if not media_files:
        print("No media files found in imports directory.")
        return

    imported = duplicates = warnings = 0

    for media in sorted(media_files):
        json_path = media.with_suffix(".json")
        if not json_path.exists():
            print(f"WARNING: no sidecar for {media.name}, skipping")
            warnings += 1
            continue

        if dry_run:
            print(f"  [dry-run] would import {media.name}")
            imported += 1
            continue

        try:
            result = import_gramoire_file(media, json_path, storage_base, db_path)
        except Exception as exc:
            print(f"WARNING: failed to import {media.name}: {exc}, skipping")
            warnings += 1
            continue

        if result == "duplicate":
            print(f"  Duplicate: {media.name}")
            duplicates += 1
        else:
            print(f"  Imported:  {media.name}")
            imported += 1
        json_path.unlink(missing_ok=True)
        media.unlink(missing_ok=True)

    parts = []
    if imported:
        parts.append(f"{imported} imported")
    if duplicates:
        parts.append(f"{duplicates} duplicate{'s' if duplicates > 1 else ''}")
    if warnings:
        parts.append(f"{warnings} warning{'s' if warnings > 1 else ''}")
    print("\nDone: " + (", ".join(parts) if parts else "nothing to do"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=None, help="SQLite database path")
    parser.add_argument("--storage", type=Path, default=None, help="Storage base path")
    parser.add_argument(
        "--dry-run", action="store_true", help="Log actions without making changes"
    )
    args = parser.parse_args()

    if args.db:
        db_path = args.db
    else:
        from api.config import DB_PATH

        db_path = DB_PATH

    if args.storage:
        storage_base = args.storage
    else:
        from api.config import STORAGE_BASE

        storage_base = STORAGE_BASE

    if not db_path.exists():
        print(f"Error: database not found: {db_path}", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print(f"[dry-run] Scanning {storage_base / 'imports'}\n")
    else:
        print(f"Importing from {storage_base / 'imports'} into {db_path}\n")

    run_import(db_path, storage_base, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
