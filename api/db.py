import json
import logging
import lzma
import re
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)

MEDIA_EXTS = {".jpg", ".jpeg", ".webp", ".png", ".mp4"}
_EMPTY_SIDECAR: dict = dict(
    shortcode=None, post_type=None, caption=None,
    like_count=None, comment_count=None, location=None,
)


def _conn(db_path: Path, read_only: bool = False) -> sqlite3.Connection:
    if read_only:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, check_same_thread=False)
    else:
        conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = _conn(db_path)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS accounts (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                platform_user_id TEXT    UNIQUE,
                username          TEXT    NOT NULL UNIQUE,
                active            INTEGER NOT NULL DEFAULT 0,
                fully_synced      INTEGER NOT NULL DEFAULT 0,
                profile_pic_path  TEXT,
                added_at          TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS media (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id      INTEGER NOT NULL REFERENCES accounts(id),
                filename        TEXT NOT NULL,
                filepath        TEXT NOT NULL UNIQUE,
                extension       TEXT,
                post_timestamp  TEXT,
                downloaded_at   TEXT NOT NULL DEFAULT (datetime('now')),
                file_size       INTEGER,
                width           INTEGER,
                height          INTEGER,
                shortcode       TEXT,
                post_type       TEXT,
                carousel_index  INTEGER,
                caption         TEXT,
                like_count      INTEGER,
                comment_count   INTEGER,
                location        TEXT,
                is_saved_post   INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_media_account_shortcode
                ON media (account_id, shortcode);
            CREATE TABLE IF NOT EXISTS ratings (
                shortcode    TEXT PRIMARY KEY,
                archived_at  TEXT,
                favorited_at TEXT
            );
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS saved_seen (
                shortcode TEXT PRIMARY KEY,
                seen_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
        cols = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
        if "instagram_user_id" in cols:
            conn.execute("ALTER TABLE accounts RENAME COLUMN instagram_user_id TO platform_user_id")
            conn.commit()
        if "profile_pic_path" not in cols:
            conn.execute("ALTER TABLE accounts ADD COLUMN profile_pic_path TEXT")
            conn.commit()
        media_cols = {row[1] for row in conn.execute("PRAGMA table_info(media)")}
        if "is_saved_post" not in media_cols:
            conn.execute("ALTER TABLE media ADD COLUMN is_saved_post INTEGER NOT NULL DEFAULT 0")
            conn.commit()
    finally:
        conn.close()


def get_active_accounts(db_path: Path) -> list[tuple[int, str, str, int]]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute(
            "SELECT id, platform_user_id, username, fully_synced FROM accounts WHERE active = 1 AND platform_user_id IS NOT NULL"
        ).fetchall()
        return [(r["id"], r["platform_user_id"], r["username"], r["fully_synced"]) for r in rows]
    finally:
        conn.close()


def shortcode_exists(shortcode: str, db_path: Path) -> bool:
    conn = _conn(db_path, read_only=True)
    try:
        row = conn.execute("SELECT 1 FROM media WHERE shortcode = ?", (shortcode,)).fetchone()
        return row is not None
    finally:
        conn.close()


def get_all_shortcodes_set(db_path: Path) -> set[str]:
    """Return all known shortcodes: downloaded media + saved-but-skipped entries."""
    conn = _conn(db_path, read_only=True)
    try:
        media = {r[0] for r in conn.execute("SELECT shortcode FROM media WHERE shortcode IS NOT NULL")}
        seen = {r[0] for r in conn.execute("SELECT shortcode FROM saved_seen")}
        return media | seen
    finally:
        conn.close()


def record_saved_seen(shortcode: str, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute(
            "INSERT OR IGNORE INTO saved_seen (shortcode) VALUES (?)",
            (shortcode,),
        )
        conn.commit()
    finally:
        conn.close()


def upsert_account(username: str, platform_user_id: str, db_path: Path) -> tuple[int, bool]:
    """Insert account if not exists, ensure active=1. Returns (account_id, is_new)."""
    conn = _conn(db_path)
    try:
        existing = conn.execute(
            "SELECT id, active FROM accounts WHERE platform_user_id = ?",
            (platform_user_id,),
        ).fetchone()
        if existing:
            if not existing["active"]:
                conn.execute("UPDATE accounts SET active = 1 WHERE id = ?", (existing["id"],))
                conn.commit()
            return existing["id"], False
        try:
            cur = conn.execute(
                "INSERT INTO accounts (username, platform_user_id, active) VALUES (?, ?, 1)",
                (username, platform_user_id),
            )
            conn.commit()
            return cur.lastrowid, True
        except sqlite3.IntegrityError:
            # Username already exists with a different platform_user_id (e.g. from a prior import)
            row = conn.execute("SELECT id FROM accounts WHERE username = ?", (username,)).fetchone()
            if row:
                return row["id"], False
            raise
    finally:
        conn.close()


def mark_as_saved_posts(shortcodes: list[str], db_path: Path) -> None:
    if not shortcodes:
        return
    conn = _conn(db_path)
    try:
        conn.executemany(
            "UPDATE media SET is_saved_post = 1 WHERE shortcode = ?",
            [(s,) for s in shortcodes],
        )
        conn.executemany(
            "INSERT OR IGNORE INTO ratings (shortcode, archived_at, favorited_at) VALUES (?, NULL, datetime('now'))",
            [(s,) for s in shortcodes],
        )
        conn.commit()
    finally:
        conn.close()


def get_unsynced_accounts(db_path: Path) -> list[tuple[int, str, str]]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute(
            "SELECT id, platform_user_id, username FROM accounts WHERE active = 1 AND fully_synced = 0 AND platform_user_id IS NOT NULL"
        ).fetchall()
        return [(r["id"], r["platform_user_id"], r["username"]) for r in rows]
    finally:
        conn.close()


def mark_account_synced(account_id: int, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute("UPDATE accounts SET fully_synced = 1 WHERE id = ?", (account_id,))
        conn.commit()
    finally:
        conn.close()


def deactivate_account(account_id: int, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute("UPDATE accounts SET active = 0 WHERE id = ?", (account_id,))
        conn.commit()
    finally:
        conn.close()


def migrate_done_files(db_path: Path, storage_base: Path) -> None:
    conn = _conn(db_path)
    try:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
        if "fully_synced" not in cols:
            conn.execute("ALTER TABLE accounts ADD COLUMN fully_synced INTEGER NOT NULL DEFAULT 0")
            conn.commit()

        rows = conn.execute(
            "SELECT id, platform_user_id FROM accounts WHERE active = 1 AND platform_user_id IS NOT NULL AND fully_synced = 0"
        ).fetchall()

        updated = 0
        for row in rows:
            done_file = storage_base / row["platform_user_id"] / ".done"
            if done_file.exists():
                conn.execute("UPDATE accounts SET fully_synced = 1 WHERE id = ?", (row["id"],))
                done_file.unlink()
                updated += 1

        if updated:
            conn.commit()
            logger.info("Migrated %d .done file(s) to fully_synced", updated)
    finally:
        conn.close()


def _typename_to_post_type(typename: str | None) -> str | None:
    return {"GraphImage": "image", "GraphSidecar": "carousel", "GraphVideo": "video"}.get(typename or "")


def _parse_stem(stem: str) -> tuple[str | None, int | None]:
    base = re.sub(r"_\d+$", "", stem)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})_UTC", base)
    post_timestamp = f"{m.group(1)}T{m.group(2)}:{m.group(3)}:{m.group(4)}Z" if m else None
    idx = re.search(r"_(\d+)$", stem)
    carousel_index = int(idx.group(1)) if idx else None
    return post_timestamp, carousel_index


def _parse_json_sidecar(json_path: Path) -> dict:
    xz_path = Path(str(json_path) + ".xz")
    try:
        if xz_path.exists():
            with lzma.open(xz_path) as f:
                raw = json.loads(f.read())
        elif json_path.exists():
            raw = json.loads(json_path.read_text())
        else:
            return _EMPTY_SIDECAR.copy()
    except Exception:
        return _EMPTY_SIDECAR.copy()

    node = raw.get("node", raw)
    edges = node.get("edge_media_to_caption", {}).get("edges", [])
    caption = node.get("caption") or (edges[0]["node"]["text"] if edges else None)
    like_count = (node.get("edge_media_preview_like") or node.get("edge_liked_by") or {}).get("count")
    comments = node.get("comments")
    comment_count = (
        comments if isinstance(comments, int)
        else (node.get("edge_media_to_comment") or {}).get("count")
    )
    return dict(
        shortcode=node.get("shortcode"),
        post_type=_typename_to_post_type(node.get("__typename")),
        caption=caption,
        like_count=like_count,
        comment_count=comment_count,
        location=(node.get("location") or {}).get("name"),
    )


def index_account(account_id: int, dest_dir: Path, db_path: Path) -> int:
    media_files = [f for f in dest_dir.iterdir() if f.is_file() and f.suffix.lower() in MEDIA_EXTS]

    conn = _conn(db_path, read_only=True)
    try:
        known = {row[0] for row in conn.execute("SELECT filepath FROM media WHERE account_id = ?", (account_id,))}
    finally:
        conn.close()

    new_files = [f for f in media_files if str(f.relative_to(dest_dir.parent)) not in known]
    if not new_files:
        return 0

    groups: dict[str, list[Path]] = {}
    for f in new_files:
        base = re.sub(r"_\d+$", "", f.stem)
        groups.setdefault(base, []).append(f)

    rows = []
    for base, files in groups.items():
        sidecar = _parse_json_sidecar(dest_dir / f"{base}.json")
        for f in sorted(files):
            post_timestamp, carousel_index = _parse_stem(f.stem)
            file_size = f.stat().st_size
            width = height = None
            try:
                from PIL import Image
                with Image.open(f) as img:
                    width, height = img.size
            except Exception:
                pass
            rows.append((
                account_id, f.name, str(f.relative_to(dest_dir.parent)), f.suffix[1:].lower(),
                post_timestamp, file_size, width, height,
                sidecar["shortcode"], sidecar["post_type"], carousel_index,
                sidecar["caption"], sidecar["like_count"], sidecar["comment_count"], sidecar["location"],
            ))

        for p in [dest_dir / f"{base}.json", dest_dir / f"{base}.json.xz"]:
            p.unlink(missing_ok=True)

    json_pat = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_UTC.*\.json(\.xz)?$")
    for f in dest_dir.iterdir():
        if json_pat.match(f.name):
            f.unlink(missing_ok=True)

    if rows:
        conn = _conn(db_path)
        try:
            conn.executemany(
                """INSERT OR IGNORE INTO media
                    (account_id, filename, filepath, extension, post_timestamp, file_size, width, height,
                     shortcode, post_type, carousel_index, caption, like_count, comment_count, location)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                rows,
            )
            conn.commit()
        finally:
            conn.close()

    return len(rows)

def get_random_neutral_post(db_path: Path) -> dict | None:
    conn = _conn(db_path, read_only=True)
    try:
        # Pick a random account first so all accounts get equal weight
        # regardless of how many posts they have.
        account_row = conn.execute("""
            SELECT a.id
            FROM media m
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            JOIN accounts a ON a.id = m.account_id
            WHERE r.shortcode IS NULL
              AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
            GROUP BY a.id
            ORDER BY RANDOM()
            LIMIT 1
        """).fetchone()
        if not account_row:
            return None
        row = conn.execute("""
            SELECT DISTINCT m.shortcode FROM media m
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.shortcode IS NOT NULL AND r.shortcode IS NULL
              AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
              AND m.account_id = ?
            ORDER BY RANDOM() LIMIT 1
        """, (account_row["id"],)).fetchone()
        if not row:
            return None
        rows = conn.execute("""
            SELECT m.filepath, m.extension, m.post_timestamp, m.caption, m.shortcode,
                   a.username AS account, a.active AS account_active
            FROM media m
            JOIN accounts a ON a.id = m.account_id
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.shortcode = ? AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
              AND r.shortcode IS NULL
            ORDER BY m.carousel_index ASC
        """, (row["shortcode"],)).fetchall()
    finally:
        conn.close()

    if not rows:
        return None
    first = rows[0]
    return {
        "account": first["account"],
        "account_active": bool(first["account_active"]),
        "post_timestamp": first["post_timestamp"],
        "caption": first["caption"],
        "shortcode": first["shortcode"],
        "media": [(r["filepath"], r["extension"] or "jpg") for r in rows],
    }


def get_random_favorite_post(db_path: Path) -> dict | None:
    conn = _conn(db_path, read_only=True)
    try:
        # Pick a random account first so all accounts get equal weight
        # regardless of how many posts they have.
        account_row = conn.execute("""
            SELECT a.id
            FROM media m
            JOIN ratings r ON r.shortcode = m.shortcode
            JOIN accounts a ON a.id = m.account_id
            WHERE r.favorited_at IS NOT NULL
              AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
            GROUP BY a.id
            ORDER BY RANDOM()
            LIMIT 1
        """).fetchone()
        if not account_row:
            return None
        row = conn.execute("""
            SELECT DISTINCT m.shortcode FROM media m
            JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.shortcode IS NOT NULL
              AND r.favorited_at IS NOT NULL
              AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
              AND m.account_id = ?
            ORDER BY RANDOM() LIMIT 1
        """, (account_row["id"],)).fetchone()
        if not row:
            return None
        rows = conn.execute("""
            SELECT m.filepath, m.extension, m.post_timestamp, m.caption, m.shortcode,
                   a.username AS account, a.active AS account_active
            FROM media m
            JOIN accounts a ON a.id = m.account_id
            JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.shortcode = ? AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
              AND r.favorited_at IS NOT NULL
            ORDER BY m.carousel_index ASC
        """, (row["shortcode"],)).fetchall()
    finally:
        conn.close()

    if not rows:
        return None
    first = rows[0]
    return {
        "account": first["account"],
        "account_active": bool(first["account_active"]),
        "post_timestamp": first["post_timestamp"],
        "caption": first["caption"],
        "shortcode": first["shortcode"],
        "media": [(r["filepath"], r["extension"] or "jpg") for r in rows],
    }


def get_recent_posts(db_path: Path) -> list[dict]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute("""
            SELECT m.filepath, m.extension, m.post_timestamp, m.caption, m.shortcode,
                   r.archived_at, r.favorited_at, a.username AS account, a.active AS account_active
            FROM media m
            JOIN accounts a ON a.id = m.account_id
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
            ORDER BY m.post_timestamp DESC, m.carousel_index ASC
        """).fetchall()
    finally:
        conn.close()

    posts: dict[str, dict] = {}
    for row in rows:
        key = f"{row['account']}/{row['post_timestamp']}" if row["post_timestamp"] else row["filepath"]
        if key not in posts:
            posts[key] = {
                "account": row["account"],
                "account_active": bool(row["account_active"]),
                "post_timestamp": row["post_timestamp"],
                "caption": row["caption"],
                "shortcode": row["shortcode"],
                "archived_at": row["archived_at"],
                "favorited_at": row["favorited_at"],
                "media": [],
            }
        posts[key]["media"].append((row["filepath"], row["extension"] or "jpg"))

    return list(posts.values())[:100]


def upsert_rating(shortcode: str, action: str, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        if action == "archive":
            conn.execute(
                "INSERT OR REPLACE INTO ratings (shortcode, archived_at, favorited_at) VALUES (?, datetime('now'), NULL)",
                (shortcode,),
            )
        elif action == "favorite":
            conn.execute(
                "INSERT OR REPLACE INTO ratings (shortcode, archived_at, favorited_at) VALUES (?, NULL, datetime('now'))",
                (shortcode,),
            )
        elif action == "clear":
            conn.execute("DELETE FROM ratings WHERE shortcode = ?", (shortcode,))
        conn.commit()
    finally:
        conn.close()


def get_all_accounts(db_path: Path) -> list[dict]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute("""
            SELECT
                a.username,
                a.active,
                COUNT(DISTINCT m.id) AS count,
                COUNT(DISTINCT CASE WHEN r.favorited_at IS NOT NULL THEN m.shortcode END) AS favorited_count,
                COUNT(DISTINCT CASE WHEN r.archived_at  IS NOT NULL THEN m.shortcode END) AS archived_count
            FROM accounts a
            LEFT JOIN media m ON m.account_id = a.id
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            GROUP BY a.id
            ORDER BY a.username ASC
        """).fetchall()
        return [
            {
                "username": r["username"],
                "active": bool(r["active"]),
                "count": r["count"],
                "favorited_count": r["favorited_count"],
                "archived_count": r["archived_count"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def upsert_following_accounts(accounts: list[dict], db_path: Path) -> int:
    if not accounts:
        return 0
    conn = _conn(db_path)
    try:
        cur = conn.executemany(
            "INSERT OR IGNORE INTO accounts (username, platform_user_id, active) VALUES (?, ?, 1)",
            [(a["username"], a["platform_user_id"]) for a in accounts],
        )
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def save_account_profile_pic(platform_user_id: str, path: str, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute(
            "UPDATE accounts SET profile_pic_path = ? WHERE platform_user_id = ?",
            (path, platform_user_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_account_profile_pic_path(username: str, db_path: Path) -> str | None:
    conn = _conn(db_path, read_only=True)
    try:
        row = conn.execute(
            "SELECT profile_pic_path FROM accounts WHERE username = ?",
            (username,),
        ).fetchone()
        return row["profile_pic_path"] if row else None
    finally:
        conn.close()


def get_accounts_missing_profile_pic(platform_user_ids: list[str], db_path: Path) -> set[str]:
    if not platform_user_ids:
        return set()
    conn = _conn(db_path, read_only=True)
    try:
        placeholders = ",".join("?" * len(platform_user_ids))
        rows = conn.execute(
            f"SELECT platform_user_id FROM accounts"
            f" WHERE platform_user_id IN ({placeholders}) AND profile_pic_path IS NULL",
            platform_user_ids,
        ).fetchall()
        return {row["platform_user_id"] for row in rows}
    finally:
        conn.close()


def get_stats(db_path: Path, storage_base: Path) -> dict:
    import subprocess
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute("""
            SELECT a.username AS account, COUNT(*) AS count FROM media m
            JOIN accounts a ON a.id = m.account_id
            WHERE m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
            GROUP BY m.account_id ORDER BY count DESC
        """).fetchall()
    finally:
        conn.close()

    accounts = [{"account": r["account"], "count": r["count"]} for r in rows]
    total = sum(a["count"] for a in accounts)

    disk_bytes = 0
    try:
        result = subprocess.run(
            ["du", "-sk", str(storage_base)],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            disk_bytes = int(result.stdout.split("\t")[0]) * 1024
    except Exception:
        pass

    return {"accounts": accounts, "total": total, "diskBytes": disk_bytes}


# --- Backfill ---

def init_backfill_progress(db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS backfill_progress (
                account_id       INTEGER PRIMARY KEY REFERENCES accounts(id),
                cursor_timestamp TEXT,
                updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
    finally:
        conn.close()


def get_accounts_with_missing_metadata(db_path: Path) -> list[tuple[int, str, str]]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute("""
            SELECT DISTINCT a.id, a.platform_user_id, a.username
            FROM media m
            JOIN accounts a ON a.id = m.account_id
            WHERE m.shortcode IS NULL
              AND a.active = 1
              AND a.platform_user_id IS NOT NULL
            ORDER BY a.username
        """).fetchall()
        return [(r[0], r[1], r[2]) for r in rows]
    finally:
        conn.close()


def get_null_post_timestamps(account_id: int, db_path: Path) -> set[str]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute(
            "SELECT DISTINCT post_timestamp FROM media"
            " WHERE account_id = ? AND shortcode IS NULL AND post_timestamp IS NOT NULL",
            (account_id,),
        ).fetchall()
        return {r[0] for r in rows}
    finally:
        conn.close()


def update_post_metadata(
    account_id: int,
    post_timestamp: str,
    *,
    shortcode: str,
    post_type: str | None,
    caption: str | None,
    like_count: int | None,
    comment_count: int | None,
    location: str | None,
    db_path: Path,
) -> int:
    conn = _conn(db_path)
    try:
        cur = conn.execute(
            """UPDATE media
               SET shortcode=?, post_type=?, caption=?, like_count=?, comment_count=?, location=?
               WHERE account_id=? AND post_timestamp=? AND shortcode IS NULL""",
            (shortcode, post_type, caption, like_count, comment_count, location,
             account_id, post_timestamp),
        )
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def get_backfill_cursor(account_id: int, db_path: Path) -> str | None:
    conn = _conn(db_path, read_only=True)
    try:
        row = conn.execute(
            "SELECT cursor_timestamp FROM backfill_progress WHERE account_id = ?",
            (account_id,),
        ).fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def save_backfill_cursor(account_id: int, cursor_timestamp: str, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute(
            """INSERT INTO backfill_progress (account_id, cursor_timestamp, updated_at)
               VALUES (?, ?, datetime('now'))
               ON CONFLICT (account_id) DO UPDATE SET
                   cursor_timestamp = excluded.cursor_timestamp,
                   updated_at       = excluded.updated_at""",
            (account_id, cursor_timestamp),
        )
        conn.commit()
    finally:
        conn.close()


def get_setting(key: str, db_path: Path) -> str | None:
    conn = _conn(db_path, read_only=True)
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None
    finally:
        conn.close()


def set_setting(key: str, value: str, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)"
            " ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        conn.commit()
    finally:
        conn.close()


def delete_setting(key: str, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute("DELETE FROM settings WHERE key = ?", (key,))
        conn.commit()
    finally:
        conn.close()
