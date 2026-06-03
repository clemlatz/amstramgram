import json
from pathlib import Path
import sqlite3
from api.db import (
    init_db,
    index_account,
    get_active_accounts,
    mark_as_saved_posts,
    migrate_done_files,
    shortcode_exists,
    get_unsynced_accounts,
    mark_account_synced,
    upsert_account,
)


def _insert_account(
    db: Path, username: str, ig_id: str, active: int = 1, fully_synced: int = 0
) -> int:
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
    tables = {
        r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
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
    _insert_account(db, "bob", "222", fully_synced=1)  # synced — excluded
    _insert_account(db, "carol", "333", active=0)  # inactive — excluded
    rows = get_unsynced_accounts(db)
    assert len(rows) == 1
    assert rows[0][2] == "alice"


def test_mark_account_synced(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111", fully_synced=0)
    mark_account_synced(account_id, db)
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT fully_synced FROM accounts WHERE id = ?", (account_id,)
    ).fetchone()
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
    row = conn.execute(
        "SELECT fully_synced FROM accounts WHERE id = ?", (account_id,)
    ).fetchone()
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
    row = conn.execute(
        "SELECT fully_synced FROM accounts WHERE id = ?", (account_id,)
    ).fetchone()
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
    row = conn.execute(
        "SELECT fully_synced FROM accounts WHERE id = ?", (account_id,)
    ).fetchone()
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
    conn.execute(
        "INSERT INTO accounts (username, platform_user_id, active) VALUES ('alice', '111', 1)"
    )
    conn.commit()
    conn.close()

    (storage / "111").mkdir(parents=True)
    (storage / "111" / ".done").write_text("")

    migrate_done_files(db, storage)

    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT fully_synced FROM accounts WHERE username = 'alice'"
    ).fetchone()
    conn.close()
    assert row[0] == 1
    assert not (storage / "111" / ".done").exists()


def _make_jpeg(path: Path) -> None:
    path.write_bytes(
        bytes(
            [
                0xFF,
                0xD8,
                0xFF,
                0xE0,
                0x00,
                0x10,
                0x4A,
                0x46,
                0x49,
                0x46,
                0x00,
                0x01,
                0x01,
                0x00,
                0x00,
                0x01,
                0x00,
                0x01,
                0x00,
                0x00,
                0xFF,
                0xD9,
            ]
        )
    )


def test_index_account_extracts_metadata_from_json_sidecar(tmp_path):
    db = tmp_path / "test.db"
    storage = tmp_path / "storage"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")

    dest = storage / "111"
    dest.mkdir(parents=True)

    _make_jpeg(dest / "2024-01-15_12-00-00_UTC.jpg")

    (dest / "2024-01-15_12-00-00_UTC.json").write_text(
        json.dumps(
            {
                "node": {
                    "shortcode": "Abc123XYZ",
                    "__typename": "GraphImage",
                    "caption": "Belle photo",
                    "edge_media_preview_like": {"count": 42},
                    "edge_media_to_comment": {"count": 7},
                    "location": {"name": "Paris"},
                }
            }
        )
    )

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
    assert not (dest / "2024-01-15_12-00-00_UTC.json").exists(), (
        "JSON sidecar must be deleted after indexing"
    )


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


def _insert_media(
    db: Path,
    account_id: int,
    filepath: str,
    extension: str,
    shortcode: str = None,
    post_timestamp: str = None,
    carousel_index: int = None,
) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode,"
        " post_timestamp, carousel_index) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            account_id,
            filepath.split("/")[-1],
            filepath,
            extension,
            shortcode,
            post_timestamp,
            carousel_index,
        ),
    )
    conn.commit()
    conn.close()


def test_get_recent_posts_includes_mp4(tmp_path):
    from api.db import get_recent_posts

    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(
        db,
        acc,
        "111/reel.mp4",
        "mp4",
        shortcode="VID001",
        post_timestamp="2026-01-01T10:00:00Z",
    )
    posts = get_recent_posts(db)
    assert len(posts) == 1
    assert posts[0]["media"] == [("111/reel.mp4", "mp4", None, None)]


def test_get_recent_posts_excludes_gif(tmp_path):
    from api.db import get_recent_posts

    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(
        db,
        acc,
        "111/anim.gif",
        "gif",
        shortcode="GIF001",
        post_timestamp="2026-01-01T10:00:00Z",
    )
    assert get_recent_posts(db) == []


def test_get_recent_posts_groups_mixed_carousel(tmp_path):
    from api.db import get_recent_posts

    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    ts = "2026-01-01T10:00:00Z"
    _insert_media(
        db,
        acc,
        "111/c_1.jpg",
        "jpg",
        shortcode="CAR001",
        post_timestamp=ts,
        carousel_index=1,
    )
    _insert_media(
        db,
        acc,
        "111/c_2.mp4",
        "mp4",
        shortcode="CAR001",
        post_timestamp=ts,
        carousel_index=2,
    )
    posts = get_recent_posts(db)
    assert len(posts) == 1
    media = posts[0]["media"]
    assert ("111/c_1.jpg", "jpg", None, None) in media
    assert ("111/c_2.mp4", "mp4", None, None) in media


def test_get_random_neutral_post_includes_mp4(tmp_path):
    from api.db import get_random_neutral_post

    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(
        db,
        acc,
        "111/reel.mp4",
        "mp4",
        shortcode="VID001",
        post_timestamp="2026-01-01T10:00:00Z",
    )
    post = get_random_neutral_post(db)
    assert post is not None
    assert post["media"] == [("111/reel.mp4", "mp4", None, None)]


def test_get_random_neutral_post_returns_none_when_all_rated(tmp_path):
    from api.db import get_random_neutral_post, upsert_rating

    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(
        db,
        acc,
        "111/reel.mp4",
        "mp4",
        shortcode="VID001",
        post_timestamp="2026-01-01T10:00:00Z",
    )
    upsert_rating("VID001", "archive", db)
    assert get_random_neutral_post(db) is None


def test_get_random_favorite_post_returns_none_when_no_favorites(tmp_path):
    from api.db import get_random_favorite_post

    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(
        db,
        acc,
        "111/img.jpg",
        "jpg",
        shortcode="POST001",
        post_timestamp="2026-01-01T10:00:00Z",
    )
    assert get_random_favorite_post(db) is None


def test_get_random_favorite_post_returns_favorited_post(tmp_path):
    from api.db import get_random_favorite_post, upsert_rating

    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(
        db,
        acc,
        "111/img.jpg",
        "jpg",
        shortcode="POST001",
        post_timestamp="2026-01-01T10:00:00Z",
    )
    upsert_rating("POST001", "favorite", db)
    post = get_random_favorite_post(db)
    assert post is not None
    assert post["shortcode"] == "POST001"
    assert post["media"] == [("111/img.jpg", "jpg", None, None)]


def test_get_random_favorite_post_excludes_unrated_and_archived(tmp_path):
    from api.db import get_random_favorite_post, upsert_rating

    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(
        db,
        acc,
        "111/unrated.jpg",
        "jpg",
        shortcode="UNRATED",
        post_timestamp="2026-01-01T10:00:00Z",
    )
    _insert_media(
        db,
        acc,
        "111/archived.jpg",
        "jpg",
        shortcode="ARCHIVED",
        post_timestamp="2026-01-02T10:00:00Z",
    )
    _insert_media(
        db,
        acc,
        "111/fav.jpg",
        "jpg",
        shortcode="FAVED",
        post_timestamp="2026-01-03T10:00:00Z",
    )
    upsert_rating("ARCHIVED", "archive", db)
    upsert_rating("FAVED", "favorite", db)
    post = get_random_favorite_post(db)
    assert post is not None
    assert post["shortcode"] == "FAVED"


def test_mark_as_saved_posts_sets_flag_and_favorites(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/a.jpg", "jpg", shortcode="SC001")
    _insert_media(db, acc, "111/b.jpg", "jpg", shortcode="SC002")

    mark_as_saved_posts(["SC001", "SC002"], db)

    conn = sqlite3.connect(str(db))
    flags = {
        r[0]: r[1] for r in conn.execute("SELECT shortcode, is_saved_post FROM media")
    }
    ratings = {
        r[0]: r[1] for r in conn.execute("SELECT shortcode, favorited_at FROM ratings")
    }
    conn.close()

    assert flags["SC001"] == 1
    assert flags["SC002"] == 1
    assert ratings["SC001"] is not None
    assert ratings["SC002"] is not None


def test_mark_as_saved_posts_does_not_overwrite_existing_rating(tmp_path):
    from api.db import upsert_rating

    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/a.jpg", "jpg", shortcode="SC001")
    upsert_rating("SC001", "archive", db)

    mark_as_saved_posts(["SC001"], db)

    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT archived_at, favorited_at FROM ratings WHERE shortcode = 'SC001'"
    ).fetchone()
    conn.close()

    assert row[0] is not None, "archived_at must be preserved"
    assert row[1] is None, "favorited_at must not be set when a rating already exists"


def test_mark_as_saved_posts_noop_on_empty_list(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    mark_as_saved_posts([], db)


def test_upsert_account_updates_username_on_rename(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    _insert_account(db, "old_name", "42", active=0)

    account_id, is_new = upsert_account("new_name", "42", db)

    assert is_new is False
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT username, active FROM accounts WHERE id = ?", (account_id,)
    ).fetchone()
    conn.close()
    assert row[0] == "new_name"
    assert row[1] == 0  # active state unchanged


def test_upsert_account_creates_new(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)

    account_id, is_new = upsert_account("newuser", "99", db)

    assert is_new is True
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT username, active FROM accounts WHERE id = ?", (account_id,)
    ).fetchone()
    conn.close()
    assert row[0] == "newuser"
    assert row[1] == 0
