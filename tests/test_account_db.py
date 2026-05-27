import sqlite3
from pathlib import Path


from api.db import (
    init_db,
    get_setting,
    set_setting,
    delete_setting,
    upsert_following_accounts,
    save_account_profile_pic,
    get_account_profile_pic_path,
    get_accounts_missing_profile_pic,
    get_all_accounts,
    get_account_detail,
    get_account_posts,
)


def test_init_db_creates_settings_table(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    conn = sqlite3.connect(str(db))
    tables = {
        r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
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


def test_bio_columns_exist_after_init(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    import sqlite3

    conn = sqlite3.connect(str(db))
    cols = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
    conn.close()
    assert "bio" in cols
    assert "full_name" in cols
    assert "external_url" in cols


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
    upsert_following_accounts(
        [
            {"username": "alice", "platform_user_id": "111"},
            {"username": "bob", "platform_user_id": "222"},
        ],
        db,
    )
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


def _insert_rating(
    db: Path, shortcode: str, *, favorited: bool = False, archived: bool = False
) -> None:
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
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username='alice'"
    ).fetchone()[0]
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
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username='carol'"
    ).fetchone()[0]
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


def test_get_account_detail_returns_none_for_unknown(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_account_detail("nobody", db) is None


def test_get_account_detail_returns_basic_fields(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    result = get_account_detail("alice", db)
    assert result is not None
    assert result["username"] == "alice"
    assert result["active"] is True
    assert result["post_count"] == 0
    assert result["unrated_count"] == 0
    assert result["favorited_count"] == 0
    assert result["archived_count"] == 0


def test_get_account_detail_counts_posts_and_ratings(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username='alice'"
    ).fetchone()[0]
    conn.close()
    _insert_media(db, account_id, "sc1")
    _insert_media(db, account_id, "sc2")
    _insert_media(db, account_id, "sc3")
    _insert_rating(db, "sc1", favorited=True)
    _insert_rating(db, "sc2", archived=True)

    result = get_account_detail("alice", db)
    assert result["post_count"] == 3
    assert result["unrated_count"] == 1  # sc3 has no rating
    assert result["favorited_count"] == 1
    assert result["archived_count"] == 1


def test_get_account_detail_returns_bio_fields(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    # bio fields are stored by Task 4; insert directly until then
    conn = sqlite3.connect(str(db))
    conn.execute(
        "UPDATE accounts SET bio=?, full_name=?, external_url=? WHERE username='alice'",
        ("Hello world", "Alice Smith", "https://example.com"),
    )
    conn.commit()
    conn.close()
    result = get_account_detail("alice", db)
    assert result["bio"] == "Hello world"
    assert result["full_name"] == "Alice Smith"
    assert result["external_url"] == "https://example.com"


def _insert_media_with_timestamp(
    db: Path, account_id: int, shortcode: str, ts: str, filepath: str
) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, post_timestamp)"
        " VALUES (?, ?, ?, 'jpg', ?, ?)",
        (account_id, f"{shortcode}.jpg", filepath, shortcode, ts),
    )
    conn.commit()
    conn.close()


def test_get_account_posts_returns_empty_for_unknown(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_account_posts("nobody", db) == []


def test_get_account_posts_returns_posts_for_account(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username='alice'"
    ).fetchone()[0]
    conn.close()
    _insert_media_with_timestamp(
        db, account_id, "sc1", "2024-01-02T00:00:00Z", "111/sc1.jpg"
    )
    _insert_media_with_timestamp(
        db, account_id, "sc2", "2024-01-01T00:00:00Z", "111/sc2.jpg"
    )
    posts = get_account_posts("alice", db)
    assert len(posts) == 2
    assert posts[0]["shortcode"] == "sc1"  # newer first
    assert posts[1]["shortcode"] == "sc2"


def test_get_account_posts_does_not_include_other_accounts(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts(
        [
            {"username": "alice", "platform_user_id": "111"},
            {"username": "bob", "platform_user_id": "222"},
        ],
        db,
    )
    conn = sqlite3.connect(str(db))
    alice_id = conn.execute(
        "SELECT id FROM accounts WHERE username='alice'"
    ).fetchone()[0]
    bob_id = conn.execute("SELECT id FROM accounts WHERE username='bob'").fetchone()[0]
    conn.close()
    _insert_media_with_timestamp(
        db, alice_id, "sc_alice", "2024-01-01T00:00:00Z", "111/a.jpg"
    )
    _insert_media_with_timestamp(
        db, bob_id, "sc_bob", "2024-01-01T00:00:00Z", "222/b.jpg"
    )
    posts = get_account_posts("alice", db)
    assert len(posts) == 1
    assert posts[0]["shortcode"] == "sc_alice"


def test_get_account_posts_groups_carousel_slides(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username='alice'"
    ).fetchone()[0]
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, post_timestamp, carousel_index)"
        " VALUES (?, 'sc1_1.jpg', '111/sc1_1.jpg', 'jpg', 'sc1', '2024-01-01T00:00:00Z', 1)",
        (account_id,),
    )
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, post_timestamp, carousel_index)"
        " VALUES (?, 'sc1_2.jpg', '111/sc1_2.jpg', 'jpg', 'sc1', '2024-01-01T00:00:00Z', 2)",
        (account_id,),
    )
    conn.commit()
    conn.close()
    posts = get_account_posts("alice", db)
    assert len(posts) == 1
    assert len(posts[0]["media"]) == 2


from api.db import get_account_preview_media


def _insert_media_ext(
    db: Path,
    account_id: int,
    shortcode: str,
    filepath: str,
    extension: str = "jpg",
    carousel_index: int | None = None,
) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, carousel_index)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (account_id, f"{shortcode}.{extension}", filepath, extension, shortcode, carousel_index),
    )
    conn.commit()
    conn.close()


def _get_account_id(db: Path, username: str) -> int:
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT id FROM accounts WHERE username = ?", (username,)
    ).fetchone()
    conn.close()
    return row[0]


def test_get_account_preview_media_returns_empty_for_unknown(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    result = get_account_preview_media("nobody", 5, db)
    assert result == []


def test_get_account_preview_media_returns_up_to_count(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    aid = _get_account_id(db, "alice")
    for i in range(7):
        _insert_media_ext(db, aid, f"sc{i}", f"media/111/sc{i}.jpg")
    result = get_account_preview_media("alice", 5, db)
    assert len(result) == 5


def test_get_account_preview_media_returns_filepath_and_extension(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    aid = _get_account_id(db, "alice")
    _insert_media_ext(db, aid, "sc1", "media/111/sc1.jpg")
    result = get_account_preview_media("alice", 5, db)
    assert len(result) == 1
    assert result[0]["filepath"] == "media/111/sc1.jpg"
    assert result[0]["extension"] == "jpg"


def test_get_account_preview_media_prefers_favorites(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    aid = _get_account_id(db, "alice")
    # 1 favorite, 3 neutrals — with count=1 we should always get the favorite
    _insert_media_ext(db, aid, "fav1", "media/111/fav1.jpg")
    _insert_rating(db, "fav1", favorited=True)
    for i in range(3):
        _insert_media_ext(db, aid, f"neu{i}", f"media/111/neu{i}.jpg")
    results = [get_account_preview_media("alice", 1, db)[0]["filepath"] for _ in range(10)]
    assert all(r == "media/111/fav1.jpg" for r in results)


def test_get_account_preview_media_uses_archived_before_neutral(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    aid = _get_account_id(db, "alice")
    # 1 archived, 3 neutrals — count=1 must always return the archived
    _insert_media_ext(db, aid, "arc1", "media/111/arc1.jpg")
    _insert_rating(db, "arc1", archived=True)
    for i in range(3):
        _insert_media_ext(db, aid, f"neu{i}", f"media/111/neu{i}.jpg")
    results = [get_account_preview_media("alice", 1, db)[0]["filepath"] for _ in range(10)]
    assert all(r == "media/111/arc1.jpg" for r in results)


def test_get_account_preview_media_skips_carousel_duplicates(tmp_path):
    """Only the first slide of a carousel (carousel_index=1) should appear; index=2 excluded."""
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    aid = _get_account_id(db, "alice")
    _insert_media_ext(db, aid, "car1", "media/111/car1_1.jpg", carousel_index=1)
    _insert_media_ext(db, aid, "car1", "media/111/car1_2.jpg", carousel_index=2)
    result = get_account_preview_media("alice", 5, db)
    assert len(result) == 1
    assert result[0]["filepath"] == "media/111/car1_1.jpg"


def test_get_account_preview_media_includes_single_posts(tmp_path):
    """Single posts have carousel_index=NULL and must be included."""
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    aid = _get_account_id(db, "alice")
    _insert_media_ext(db, aid, "single", "media/111/single.jpg", carousel_index=None)
    result = get_account_preview_media("alice", 5, db)
    assert len(result) == 1


def test_get_account_preview_media_does_not_include_other_accounts(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts(
        [
            {"username": "alice", "platform_user_id": "111"},
            {"username": "bob", "platform_user_id": "222"},
        ],
        db,
    )
    alice_id = _get_account_id(db, "alice")
    bob_id = _get_account_id(db, "bob")
    _insert_media_ext(db, alice_id, "a1", "media/111/a1.jpg")
    _insert_media_ext(db, bob_id, "b1", "media/222/b1.jpg")
    result = get_account_preview_media("alice", 5, db)
    assert len(result) == 1
    assert result[0]["filepath"] == "media/111/a1.jpg"
