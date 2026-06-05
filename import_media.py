#!/usr/bin/env python3
"""Import media files and Gramoire JSON sidecars from STORAGE_BASE/imports/."""

import argparse
import sys
from pathlib import Path

from api.db import MEDIA_EXTS, init_db
from api.importer import run_import as _run_import


def run_import(db_path: Path, storage_base: Path, dry_run: bool) -> None:
    imports_dir = storage_base / "imports"
    if not imports_dir.exists():
        print(f"Imports directory not found: {imports_dir}")
        return

    if dry_run:
        media_files = sorted(
            f for f in imports_dir.iterdir()
            if f.is_file() and f.suffix.lower() in MEDIA_EXTS
        )
        if not media_files:
            print("No media files found in imports directory.")
            return
        would_import = 0
        warnings = 0
        for media in media_files:
            if not media.with_suffix(".json").exists():
                print(f"WARNING: no sidecar for {media.name}, skipping")
                warnings += 1
            else:
                print(f"  [dry-run] would import {media.name}")
                would_import += 1
        parts = []
        if would_import:
            parts.append(f"{would_import} would be imported")
        if warnings:
            parts.append(f"{warnings} warning{'s' if warnings > 1 else ''}")
        print("\nDone: " + (", ".join(parts) if parts else "nothing to do"))
        return

    result = _run_import(db_path, storage_base)
    imported, duplicates, warnings = result["imported"], result["duplicates"], result["warnings"]

    if imported == 0 and duplicates == 0 and warnings == 0:
        print("No media files found in imports directory.")
        return

    if warnings:
        print(f"WARNING: {warnings} file(s) skipped (no sidecar or import error)")

    parts = []
    if imported:
        parts.append(f"{imported} imported")
    if duplicates:
        parts.append(f"{duplicates} duplicate{'s' if duplicates > 1 else ''}")
    if warnings:
        parts.append(f"{warnings} warning{'s' if warnings > 1 else ''}")
    print("\nDone: " + ", ".join(parts))


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
