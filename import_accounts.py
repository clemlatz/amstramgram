#!/usr/bin/env python3
"""Import accounts from a text file (one username per line) into the database with active=0."""

import argparse
import sqlite3
import sys
from pathlib import Path


def import_accounts(db_path: Path, accounts_file: Path) -> None:
    usernames = [
        line.strip()
        for line in accounts_file.read_text().splitlines()
        if line.strip() and not line.startswith("#")
    ]

    if not usernames:
        print("No accounts found in file.")
        return

    conn = sqlite3.connect(str(db_path))
    try:
        added = 0
        skipped = 0
        for username in usernames:
            cur = conn.execute(
                "INSERT OR IGNORE INTO accounts (username, active) VALUES (?, 0)",
                (username,),
            )
            if cur.rowcount:
                print(f"  Added:   {username}")
                added += 1
            else:
                print(f"  Skipped: {username} (already exists)")
                skipped += 1
        conn.commit()
    finally:
        conn.close()

    print(f"\nDone: {added} added, {skipped} skipped.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="Path to the SQLite database (default: from DB_PATH env or config)",
    )
    parser.add_argument(
        "--file",
        type=Path,
        default=Path("accounts.txt"),
        help="Path to the accounts file (default: accounts.txt)",
    )
    args = parser.parse_args()

    if args.db:
        db_path = args.db
    else:
        from api.config import DB_PATH

        db_path = DB_PATH

    if not args.file.exists():
        print(f"Error: file not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    if not db_path.exists():
        print(f"Error: database not found: {db_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Importing from {args.file} into {db_path}\n")
    import_accounts(db_path, args.file)


if __name__ == "__main__":
    main()
