from unittest.mock import MagicMock, patch
from pathlib import Path

import pytest

from api.db import init_db


def _make_video_post(shortcode: str, product_type: str) -> MagicMock:
    post = MagicMock()
    post.shortcode = shortcode
    post.is_video = True
    post.product_type = product_type
    post.owner_username = "alice"
    post.owner_id = 111
    return post


def _run_sync(posts, tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    storage.mkdir()

    L = MagicMock()
    profile = MagicMock()
    profile.get_saved_posts.return_value = posts

    with patch("api.saved.instaloader.Profile.own_profile", return_value=profile), \
         patch("api.saved._set_session_headers"), \
         patch("api.saved.record_saved_seen") as mock_seen, \
         patch("api.saved.upsert_account", return_value=(1, False)), \
         patch("api.saved.download_lock"), \
         patch("api.saved.index_account", return_value=0), \
         patch("api.saved.mark_as_saved_posts"), \
         patch("api.saved.time.sleep"):
        from api.saved import sync_saved_posts
        count, _ = sync_saved_posts(L, db, storage)
        return count, mock_seen


def test_sync_saved_skips_regular_feed_video(tmp_path):
    feed_video = _make_video_post("FV001", product_type="feed")
    count, mock_seen = _run_sync([feed_video], tmp_path)
    assert count == 0
    mock_seen.assert_called_once_with("FV001", tmp_path / "test.db")


def test_sync_saved_skips_igtv(tmp_path):
    igtv = _make_video_post("IG001", product_type="igtv")
    count, mock_seen = _run_sync([igtv], tmp_path)
    assert count == 0
    mock_seen.assert_called_once_with("IG001", tmp_path / "test.db")


def test_sync_saved_downloads_reel(tmp_path):
    reel = _make_video_post("REEL001", product_type="clips")
    count, mock_seen = _run_sync([reel], tmp_path)
    assert count == 1
    mock_seen.assert_not_called()
