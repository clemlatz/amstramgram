"""Tests for backfill DB functions and utility functions."""
import math
import sqlite3
from pathlib import Path
import pytest

from api.db import (
    init_db,
    init_backfill_progress,
    get_accounts_with_missing_metadata,
    get_null_post_timestamps,
    update_post_metadata,
    get_backfill_cursor,
    save_backfill_cursor,
)
from api.scheduler import _lognormal_delay


# --- helpers ---

def _insert_account(db: Path, username: str, ig_id: str, active: int = 1) -> int:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO accounts (username, platform_user_id, active) VALUES (?, ?, ?)",
        (username, ig_id, active),
    )
    conn.commit()
    row_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return row_id


def _insert_media(db: Path, account_id: int, filename: str, shortcode: str | None = None,
                  post_timestamp: str | None = None) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, shortcode, post_timestamp)"
        " VALUES (?, ?, ?, ?, ?)",
        (account_id, filename, f"111/{filename}", shortcode, post_timestamp),
    )
    conn.commit()
    conn.close()


# --- init_backfill_progress ---

def test_init_backfill_progress_creates_table(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    init_backfill_progress(db)

    conn = sqlite3.connect(str(db))
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    assert "backfill_progress" in tables


def test_init_backfill_progress_is_idempotent(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    init_backfill_progress(db)
    init_backfill_progress(db)  # must not raise


# --- get_accounts_with_missing_metadata ---

def test_get_accounts_with_missing_metadata_returns_affected_accounts(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")
    _insert_media(db, account_id, "photo.jpg", shortcode=None, post_timestamp="2024-01-01T10:00:00Z")

    rows = get_accounts_with_missing_metadata(db)
    assert len(rows) == 1
    assert rows[0] == (account_id, "111", "alice")


def test_get_accounts_with_missing_metadata_excludes_accounts_with_shortcodes(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")
    _insert_media(db, account_id, "photo.jpg", shortcode="ABC123")

    rows = get_accounts_with_missing_metadata(db)
    assert rows == []


def test_get_accounts_with_missing_metadata_excludes_inactive_accounts(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111", active=0)
    _insert_media(db, account_id, "photo.jpg", shortcode=None)

    rows = get_accounts_with_missing_metadata(db)
    assert rows == []


def test_get_accounts_with_missing_metadata_each_account_appears_once(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")
    _insert_media(db, account_id, "a.jpg", shortcode=None, post_timestamp="2024-01-01T10:00:00Z")
    _insert_media(db, account_id, "b.jpg", shortcode=None, post_timestamp="2024-01-02T10:00:00Z")

    rows = get_accounts_with_missing_metadata(db)
    assert len(rows) == 1


# --- get_null_post_timestamps ---

def test_get_null_post_timestamps_returns_timestamps_with_null_shortcode(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")
    _insert_media(db, account_id, "a.jpg", shortcode=None, post_timestamp="2024-01-01T10:00:00Z")
    _insert_media(db, account_id, "b.jpg", shortcode=None, post_timestamp="2024-01-02T10:00:00Z")
    _insert_media(db, account_id, "c.jpg", shortcode="ABC", post_timestamp="2024-01-03T10:00:00Z")

    ts = get_null_post_timestamps(account_id, db)
    assert ts == {"2024-01-01T10:00:00Z", "2024-01-02T10:00:00Z"}


def test_get_null_post_timestamps_excludes_null_timestamp(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")
    _insert_media(db, account_id, "a.jpg", shortcode=None, post_timestamp=None)

    ts = get_null_post_timestamps(account_id, db)
    assert ts == set()


# --- update_post_metadata ---

def test_update_post_metadata_updates_rows_with_null_shortcode(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")
    _insert_media(db, account_id, "a.jpg", shortcode=None, post_timestamp="2024-01-01T10:00:00Z")

    updated = update_post_metadata(
        account_id, "2024-01-01T10:00:00Z",
        shortcode="SC123",
        post_type="image",
        caption="Hello",
        like_count=10,
        comment_count=2,
        location="Paris",
        db_path=db,
    )

    assert updated == 1
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT shortcode, post_type, caption, like_count, comment_count, location FROM media WHERE filename='a.jpg'"
    ).fetchone()
    conn.close()
    assert row == ("SC123", "image", "Hello", 10, 2, "Paris")


def test_update_post_metadata_updates_carousel_images(tmp_path):
    """All images of a carousel (same timestamp) are updated at once."""
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")
    ts = "2024-01-01T10:00:00Z"
    _insert_media(db, account_id, "a_1.jpg", shortcode=None, post_timestamp=ts)
    _insert_media(db, account_id, "a_2.jpg", shortcode=None, post_timestamp=ts)

    updated = update_post_metadata(
        account_id, ts,
        shortcode="CAROUSEL1",
        post_type="carousel",
        caption=None, like_count=None, comment_count=None, location=None,
        db_path=db,
    )

    assert updated == 2


def test_update_post_metadata_does_not_overwrite_existing_shortcode(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    account_id = _insert_account(db, "alice", "111")
    _insert_media(db, account_id, "a.jpg", shortcode="EXISTING", post_timestamp="2024-01-01T10:00:00Z")

    updated = update_post_metadata(
        account_id, "2024-01-01T10:00:00Z",
        shortcode="NEW", post_type=None, caption=None,
        like_count=None, comment_count=None, location=None,
        db_path=db,
    )

    assert updated == 0
    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT shortcode FROM media WHERE filename='a.jpg'").fetchone()
    conn.close()
    assert row[0] == "EXISTING"


# --- get_backfill_cursor / save_backfill_cursor ---

def test_get_backfill_cursor_returns_none_when_no_progress(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    init_backfill_progress(db)
    account_id = _insert_account(db, "alice", "111")

    assert get_backfill_cursor(account_id, db) is None


def test_save_and_get_backfill_cursor(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    init_backfill_progress(db)
    account_id = _insert_account(db, "alice", "111")

    save_backfill_cursor(account_id, "2024-06-01T12:00:00Z", db)
    assert get_backfill_cursor(account_id, db) == "2024-06-01T12:00:00Z"


def test_save_backfill_cursor_overwrites_on_conflict(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    init_backfill_progress(db)
    account_id = _insert_account(db, "alice", "111")

    save_backfill_cursor(account_id, "2024-06-01T12:00:00Z", db)
    save_backfill_cursor(account_id, "2024-05-01T08:00:00Z", db)

    assert get_backfill_cursor(account_id, db) == "2024-05-01T08:00:00Z"


# --- _lognormal_delay ---

@pytest.mark.parametrize("low,high", [(3, 8), (5, 15), (180, 480)])
def test_lognormal_delay_stays_within_clamped_bounds(low, high):
    for _ in range(200):
        d = _lognormal_delay(low, high)
        assert d >= low / 2 * 0.8, f"{d} < {low / 2 * 0.8}"
        assert d <= high * 2 * 1.2, f"{d} > {high * 2 * 1.2}"


def test_lognormal_delay_is_positive():
    for _ in range(50):
        assert _lognormal_delay(3, 8) > 0


def test_lognormal_delay_median_near_geometric_mean():
    """Median of log-normal(mu, sigma) = exp(mu) ≈ geometric mean of [low, high]."""
    samples = [_lognormal_delay(5, 15) for _ in range(500)]
    median = sorted(samples)[len(samples) // 2]
    geometric_mean = math.exp((math.log(5) + math.log(15)) / 2)  # ≈ 8.66
    assert 4 < median < 15, f"median {median:.2f} unexpectedly far from {geometric_mean:.2f}"

