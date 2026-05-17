import json
from pathlib import Path
import sqlite3
import pytest
from api.db import (
    init_db,
    index_account,
    get_active_accounts,
    migrate_done_files,
    shortcode_exists,
    get_unsynced_accounts,
    mark_account_synced,
)


def _insert_account(db: Path, username: str, ig_id: str, active: int = 1, fully_synced: int = 0) -> int:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO accounts (username, platform_user_id, active, fully_synced) VALUES (?, ?, ?, ?)",
        (username, ig_id, active, fully_synced),
    )
    conn.commit()
    row_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return row_id


def test_init_db_creates_tables(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    conn = sqlite3.connect(str(db))
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    assert {"accounts", "media", "ratings"} <= tables


def test_get_active_accounts_returns_four_tuple(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    _insert_account(db, "alice", "111", fully_synced=1)
    rows = get_active_accounts(db)
    assert len(rows) == 1
    assert len(rows[0]) == 4  # (id, platform_user_id, username, fully_synced)
    assert rows[0][2] == "alice"
    assert rows[0][3] == 1


def test_get_active_accounts_excludes_inactive(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    _insert_account(db, "alice", "111", active=1)
    _insert_account(db, "bob", "222", active=0)
    rows = get_active_accounts(db)
    usernames = [r[2] for r in rows]
    assert "alice" in usernames
    assert "bob" not in usernames


def test_shortcode_exists_true(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, shortcode) VALUES (?, 'f.jpg', '111/f.jpg', 'ABC123')",
        (account_id,),
    )
    conn.commit()
    conn.close()
    assert shortcode_exists("ABC123", db) is True


def test_shortcode_exists_false(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert shortcode_exists("NOTHERE", db) is False


def test_get_unsynced_accounts_returns_only_active_unsynced(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    _insert_account(db, "alice", "111", fully_synced=0)  # expected
    _insert_account(db, "bob", "222", fully_synced=1)    # synced — excluded
    _insert_account(db, "carol", "333", active=0)        # inactive — excluded
    rows = get_unsynced_accounts(db)
    assert len(rows) == 1
    assert rows[0][2] == "alice"


def test_mark_account_synced(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111", fully_synced=0)
    mark_account_synced(account_id, db)
    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT fully_synced FROM accounts WHERE id = ?", (account_id,)).fetchone()
    conn.close()
    assert row[0] == 1


def test_migrate_done_files_sets_fully_synced(tmp_path):
    db = tmp_path / "test.db"
    storage = tmp_path / "storage"
    init_db(db)
    account_id = _insert_account(db, "alice", "111", fully_synced=0)

    (storage / "111").mkdir(parents=True)
    (storage / "111" / ".done").write_text("")

    migrate_done_files(db, storage)

    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT fully_synced FROM accounts WHERE id = ?", (account_id,)).fetchone()
    conn.close()
    assert row[0] == 1
    assert not (storage / "111" / ".done").exists()


def test_migrate_done_files_does_not_touch_accounts_without_done(tmp_path):
    db = tmp_path / "test.db"
    storage = tmp_path / "storage"
    init_db(db)
    account_id = _insert_account(db, "alice", "111", fully_synced=0)
    (storage / "111").mkdir(parents=True)  # no .done file

    migrate_done_files(db, storage)

    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT fully_synced FROM accounts WHERE id = ?", (account_id,)).fetchone()
    conn.close()
    assert row[0] == 0


def test_migrate_done_files_is_idempotent(tmp_path):
    db = tmp_path / "test.db"
    storage = tmp_path / "storage"
    init_db(db)
    account_id = _insert_account(db, "alice", "111", fully_synced=1)
    (storage / "111").mkdir(parents=True)

    migrate_done_files(db, storage)

    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT fully_synced FROM accounts WHERE id = ?", (account_id,)).fetchone()
    conn.close()
    assert row[0] == 1


def test_migrate_done_files_adds_column_on_legacy_db(tmp_path):
    db = tmp_path / "test.db"
    storage = tmp_path / "storage"

    conn = sqlite3.connect(str(db))
    conn.execute("""CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform_user_id TEXT UNIQUE,
        username TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 0,
        added_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""")
    conn.execute("INSERT INTO accounts (username, platform_user_id, active) VALUES ('alice', '111', 1)")
    conn.commit()
    conn.close()

    (storage / "111").mkdir(parents=True)
    (storage / "111" / ".done").write_text("")

    migrate_done_files(db, storage)

    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT fully_synced FROM accounts WHERE username = 'alice'").fetchone()
    conn.close()
    assert row[0] == 1
    assert not (storage / "111" / ".done").exists()


def _make_jpeg(path: Path) -> None:
    path.write_bytes(bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
        0xFF, 0xD9,
    ]))


def test_index_account_extracts_metadata_from_json_sidecar(tmp_path):
    db = tmp_path / "test.db"
    storage = tmp_path / "storage"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")

    dest = storage / "111"
    dest.mkdir(parents=True)

    _make_jpeg(dest / "2024-01-15_12-00-00_UTC.jpg")

    (dest / "2024-01-15_12-00-00_UTC.json").write_text(json.dumps({
        "node": {
            "shortcode": "Abc123XYZ",
            "__typename": "GraphImage",
            "caption": "Belle photo",
            "edge_media_preview_like": {"count": 42},
            "edge_media_to_comment": {"count": 7},
            "location": {"name": "Paris"},
        }
    }))

    new_count = index_account(account_id, dest, db)

    assert new_count == 1
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT shortcode, caption, like_count, comment_count, location FROM media WHERE filename = ?",
        ("2024-01-15_12-00-00_UTC.jpg",),
    ).fetchone()
    conn.close()

    assert row[0] == "Abc123XYZ"
    assert row[1] == "Belle photo"
    assert row[2] == 42
    assert row[3] == 7
    assert row[4] == "Paris"
    assert not (dest / "2024-01-15_12-00-00_UTC.json").exists(), "JSON sidecar must be deleted after indexing"


def test_index_account_metadata_null_without_json_sidecar(tmp_path):
    db = tmp_path / "test.db"
    storage = tmp_path / "storage"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")

    dest = storage / "111"
    dest.mkdir(parents=True)
    _make_jpeg(dest / "2024-01-15_12-00-00_UTC.jpg")

    new_count = index_account(account_id, dest, db)

    assert new_count == 1
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT shortcode, caption FROM media WHERE filename = ?",
        ("2024-01-15_12-00-00_UTC.jpg",),
    ).fetchone()
    conn.close()

    assert row[0] is None
    assert row[1] is None


def _insert_media(db: Path, account_id: int, filepath: str, extension: str,
                  shortcode: str = None, post_timestamp: str = None,
                  carousel_index: int = None) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode,"
        " post_timestamp, carousel_index) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (account_id, filepath.split("/")[-1], filepath, extension,
         shortcode, post_timestamp, carousel_index),
    )
    conn.commit()
    conn.close()


def test_get_recent_posts_includes_mp4(tmp_path):
    from api.db import get_recent_posts
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/reel.mp4", "mp4",
                  shortcode="VID001", post_timestamp="2026-01-01T10:00:00Z")
    posts = get_recent_posts(db)
    assert len(posts) == 1
    assert posts[0]["media"] == [("111/reel.mp4", "mp4")]


def test_get_recent_posts_excludes_gif(tmp_path):
    from api.db import get_recent_posts
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/anim.gif", "gif",
                  shortcode="GIF001", post_timestamp="2026-01-01T10:00:00Z")
    assert get_recent_posts(db) == []


def test_get_recent_posts_groups_mixed_carousel(tmp_path):
    from api.db import get_recent_posts
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    ts = "2026-01-01T10:00:00Z"
    _insert_media(db, acc, "111/c_1.jpg", "jpg", shortcode="CAR001",
                  post_timestamp=ts, carousel_index=1)
    _insert_media(db, acc, "111/c_2.mp4", "mp4", shortcode="CAR001",
                  post_timestamp=ts, carousel_index=2)
    posts = get_recent_posts(db)
    assert len(posts) == 1
    media = posts[0]["media"]
    assert ("111/c_1.jpg", "jpg") in media
    assert ("111/c_2.mp4", "mp4") in media


def test_get_random_neutral_post_includes_mp4(tmp_path):
    from api.db import get_random_neutral_post
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/reel.mp4", "mp4",
                  shortcode="VID001", post_timestamp="2026-01-01T10:00:00Z")
    post = get_random_neutral_post(db)
    assert post is not None
    assert post["media"] == [("111/reel.mp4", "mp4")]


def test_get_random_neutral_post_returns_none_when_all_rated(tmp_path):
    from api.db import get_random_neutral_post, upsert_rating
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/reel.mp4", "mp4",
                  shortcode="VID001", post_timestamp="2026-01-01T10:00:00Z")
    upsert_rating("VID001", "archive", db)
    assert get_random_neutral_post(db) is None
