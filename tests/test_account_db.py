import sqlite3
from pathlib import Path

import pytest

from api.db import (
    init_db, get_setting, set_setting, delete_setting,
    upsert_following_accounts,
    save_account_profile_pic,
    get_account_profile_pic_path,
    get_accounts_missing_profile_pic,
    get_all_accounts,
)


def test_init_db_creates_settings_table(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    conn = sqlite3.connect(str(db))
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    assert "settings" in tables


def test_get_setting_returns_none_when_missing(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_setting("session_id", db) is None


def test_set_and_get_setting(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    set_setting("session_id", "abc123", db)
    assert get_setting("session_id", db) == "abc123"


def test_set_setting_overwrites_existing(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    set_setting("session_id", "old", db)
    set_setting("session_id", "new", db)
    assert get_setting("session_id", db) == "new"


def test_delete_setting_removes_key(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    set_setting("username", "alice", db)
    delete_setting("username", db)
    assert get_setting("username", db) is None


def test_delete_setting_is_safe_when_key_missing(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    delete_setting("nonexistent", db)  # must not raise


def test_profile_pic_path_column_exists_after_init(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    import sqlite3
    conn = sqlite3.connect(str(db))
    cols = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
    conn.close()
    assert "profile_pic_path" in cols


def test_save_and_get_account_profile_pic(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "123"}], db)
    save_account_profile_pic("123", "123/profile.jpg", db)
    assert get_account_profile_pic_path("alice", db) == "123/profile.jpg"


def test_get_account_profile_pic_path_returns_none_for_unknown_user(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_account_profile_pic_path("nobody", db) is None


def test_get_account_profile_pic_path_returns_none_when_not_downloaded(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "123"}], db)
    assert get_account_profile_pic_path("alice", db) is None


def test_get_accounts_missing_profile_pic_returns_only_those_without_pic(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([
        {"username": "alice", "platform_user_id": "111"},
        {"username": "bob",   "platform_user_id": "222"},
    ], db)
    save_account_profile_pic("111", "111/profile.jpg", db)
    missing = get_accounts_missing_profile_pic(["111", "222"], db)
    assert missing == {"222"}


def test_get_accounts_missing_profile_pic_returns_empty_set_for_empty_input(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_accounts_missing_profile_pic([], db) == set()


def _insert_media(db: Path, account_id: int, shortcode: str) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode)"
        " VALUES (?, ?, ?, 'jpg', ?)",
        (account_id, f"{shortcode}.jpg", f"acc/{shortcode}.jpg", shortcode),
    )
    conn.commit()
    conn.close()


def _insert_rating(db: Path, shortcode: str, *, favorited: bool = False, archived: bool = False) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO ratings (shortcode, favorited_at, archived_at) VALUES (?, ?, ?)",
        (
            shortcode,
            "2024-01-01T00:00:00" if favorited else None,
            "2024-01-01T00:00:00" if archived else None,
        ),
    )
    conn.commit()
    conn.close()


def test_get_all_accounts_includes_rating_counts(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute("SELECT id FROM accounts WHERE username='alice'").fetchone()[0]
    conn.close()

    _insert_media(db, account_id, "sc1")
    _insert_media(db, account_id, "sc2")
    _insert_media(db, account_id, "sc3")
    _insert_rating(db, "sc1", favorited=True)
    _insert_rating(db, "sc2", archived=True)

    accounts = get_all_accounts(db)
    alice = next(a for a in accounts if a["username"] == "alice")
    assert alice["favorited_count"] == 1
    assert alice["archived_count"] == 1


def test_get_all_accounts_rating_counts_zero_when_no_ratings(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "bob", "platform_user_id": "222"}], db)
    accounts = get_all_accounts(db)
    bob = next(a for a in accounts if a["username"] == "bob")
    assert bob["favorited_count"] == 0
    assert bob["archived_count"] == 0


def test_get_all_accounts_counts_distinct_shortcodes(tmp_path):
    """A carousel post (multiple media rows, same shortcode) counts as one rating."""
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "carol", "platform_user_id": "333"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute("SELECT id FROM accounts WHERE username='carol'").fetchone()[0]
    conn.close()

    # Two media rows share the same shortcode (carousel)
    _insert_media(db, account_id, "carousel1")
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode)"
        " VALUES (?, 'carousel1_2.jpg', 'acc/carousel1_2.jpg', 'jpg', ?)",
        (account_id, "carousel1"),
    )
    conn.commit()
    conn.close()
    _insert_rating(db, "carousel1", favorited=True)

    accounts = get_all_accounts(db)
    carol = next(a for a in accounts if a["username"] == "carol")
    assert carol["favorited_count"] == 1  # not 2
