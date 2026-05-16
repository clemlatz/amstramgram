import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.db import init_db

pytest_plugins = ("pytest_asyncio",)


def test_set_session_headers():
    from api.scheduler import _DEFAULT_USER_AGENT, _set_session_headers

    headers = {}
    session = MagicMock()
    session.headers = headers
    context = MagicMock()
    context._session = session
    L = MagicMock()
    L.context = context

    with patch("api.scheduler.get_setting", return_value=None):
        _set_session_headers(L)

    assert headers["X-IG-App-ID"] == "936619743392459"
    assert headers["Referer"] == "https://www.instagram.com/"
    assert headers["Accept-Language"] == "en-US,en;q=0.9"
    assert headers["User-Agent"] == _DEFAULT_USER_AGENT
    assert "X-IG-WWW-Claim" not in headers


def test_set_session_headers_custom_ua():
    from api.scheduler import _set_session_headers

    headers = {}
    session = MagicMock()
    session.headers = headers
    context = MagicMock()
    context._session = session
    L = MagicMock()
    L.context = context

    custom_ua = "Mozilla/5.0 (custom)"
    with patch("api.scheduler.get_setting", return_value=custom_ua):
        _set_session_headers(L)

    assert headers["User-Agent"] == custom_ua


@pytest.mark.asyncio
async def test_wait_until_window_no_sleep_when_in_window():
    from api.scheduler import _wait_until_window

    with patch("api.scheduler.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 5, 10, 12, 0, 0)
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await _wait_until_window()
    mock_sleep.assert_not_called()


@pytest.mark.asyncio
async def test_wait_until_window_sleeps_at_night():
    from api.scheduler import _wait_until_window

    with patch("api.scheduler.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 5, 10, 2, 0, 0)
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await _wait_until_window()
    mock_sleep.assert_called_once()
    delay = mock_sleep.call_args[0][0]
    # 2am → sleeps until 7am = 5h = 18000s
    assert 17900 < delay < 18100


@pytest.mark.asyncio
async def test_wait_until_window_sleeps_after_23h():
    from api.scheduler import _wait_until_window

    with patch("api.scheduler.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 5, 10, 23, 30, 0)
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await _wait_until_window()
    mock_sleep.assert_called_once()
    delay = mock_sleep.call_args[0][0]
    # 23:30 → sleeps until 7am next day = 7.5h = 27000s
    assert 26900 < delay < 27100


def test_fetch_new_posts_skips_unsynced_accounts(tmp_path):
    from api.scheduler import _fetch_new_posts

    db = tmp_path / "test.db"
    active_accounts = [
        (1, "111", "alice", 1),  # synced — included
        (2, "222", "bob", 0),    # not synced — excluded
    ]

    with patch("api.scheduler._download_account_fast") as mock_dl:
        with patch("time.sleep"):
            _fetch_new_posts(MagicMock(), active_accounts, db)

    called_usernames = [c.args[3] for c in mock_dl.call_args_list]
    assert called_usernames == ["alice"]


def test_fetch_new_posts_no_synced_accounts_is_noop(tmp_path):
    from api.scheduler import _fetch_new_posts

    db = tmp_path / "test.db"
    active_accounts = [(1, "111", "alice", 0)]  # non synced

    with patch("api.scheduler._download_account_fast") as mock_dl:
        _fetch_new_posts(MagicMock(), active_accounts, db)

    mock_dl.assert_not_called()


def test_fetch_new_posts_calls_download_for_all_synced(tmp_path):
    from api.scheduler import _fetch_new_posts

    db = tmp_path / "test.db"
    active_accounts = [
        (1, "111", "alice", 1),
        (2, "222", "bob", 1),
        (3, "333", "carol", 0),  # not synced — excluded
    ]

    with patch("api.scheduler._download_account_fast") as mock_dl:
        with patch("time.sleep"):
            _fetch_new_posts(MagicMock(), active_accounts, db)

    called_usernames = {c.args[3] for c in mock_dl.call_args_list}
    assert called_usernames == {"alice", "bob"}


def test_download_account_fast_stops_on_existing_post(tmp_path):
    from api.scheduler import _download_account_fast

    (tmp_path / "111").mkdir()
    L = MagicMock()
    L.context.get_iphone_json.return_value = {"user": {}}
    profile = MagicMock()
    post_new = MagicMock()
    post_new.is_video = False
    post_new.typename = "GraphImage"
    post_existing = MagicMock()
    post_existing.is_video = False
    post_existing.typename = "GraphImage"
    profile.get_posts.return_value = [post_new, post_existing]
    # first → True (new post), second → False (already present)
    L.download_post.side_effect = [True, False]

    with patch("instaloader.Profile.from_iphone_struct", return_value=profile):
        with patch("api.scheduler.STORAGE_BASE", tmp_path):
            with patch("api.scheduler.index_account", return_value=0):
                with patch("time.sleep"):
                    _download_account_fast(L, 1, "111", "alice", tmp_path / "test.db")

    assert L.download_post.call_count == 2


def test_fetch_old_posts_skips_after_22h(tmp_path):
    from api.scheduler import _fetch_old_posts

    db = tmp_path / "test.db"
    with patch("api.scheduler.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 5, 10, 22, 30)
        with patch("api.scheduler.get_unsynced_accounts") as mock_q:
            _fetch_old_posts(MagicMock(), db)
    mock_q.assert_not_called()


def test_fetch_old_posts_marks_synced_when_no_new_posts(tmp_path):
    from api.scheduler import _fetch_old_posts

    db = tmp_path / "test.db"
    (tmp_path / "111").mkdir()

    with patch("api.scheduler.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 5, 10, 10, 0)
        with patch("api.scheduler.get_unsynced_accounts", return_value=[(1, "111", "alice")]):
            with patch("api.scheduler.mark_account_synced") as mock_mark:
                with patch("api.scheduler.index_account", return_value=0):
                    with patch("api.scheduler.STORAGE_BASE", tmp_path):
                        L = MagicMock()
                        L.context.get_iphone_json.return_value = {"user": {}}
                        profile = MagicMock()
                        profile.get_posts.return_value = []
                        with patch("instaloader.Profile.from_iphone_struct", return_value=profile):
                            _fetch_old_posts(L, db)
    mock_mark.assert_called_once_with(1, db)


def test_fetch_old_posts_selects_max_3_accounts(tmp_path):
    from api.scheduler import _fetch_old_posts

    db = tmp_path / "test.db"
    for i in range(10):
        (tmp_path / str(i)).mkdir()

    unsynced = [(i, str(i), f"user{i}") for i in range(10)]

    with patch("api.scheduler.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 5, 10, 10, 0)
        with patch("api.scheduler.get_unsynced_accounts", return_value=unsynced):
            with patch("api.scheduler.mark_account_synced"):
                with patch("api.scheduler.index_account", return_value=0):
                    with patch("api.scheduler.STORAGE_BASE", tmp_path):
                        with patch("time.sleep"):
                            L = MagicMock()
                            profile = MagicMock()
                            profile.get_posts.return_value = []
                            with patch("instaloader.Profile.from_iphone_struct", return_value=profile) as mock_from_struct:
                                _fetch_old_posts(L, db)
                            assert mock_from_struct.call_count <= 3


def test_fetch_new_posts_stops_when_stop_event_set(tmp_path):
    from api import scheduler as sched
    from api.scheduler import _fetch_new_posts

    sched._stop_event.set()
    try:
        active_accounts = [(1, "111", "alice", 1)]
        with patch("api.scheduler._download_account_fast") as mock_dl:
            _fetch_new_posts(MagicMock(), active_accounts, tmp_path / "test.db")
        mock_dl.assert_not_called()
    finally:
        sched._stop_event.clear()


def test_fetch_old_posts_stops_when_stop_event_set(tmp_path):
    from api import scheduler as sched
    from api.scheduler import _fetch_old_posts

    sched._stop_event.set()
    try:
        with patch("api.scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 5, 10, 10, 0)
            with patch("api.scheduler.get_unsynced_accounts", return_value=[(1, "111", "alice")]):
                with patch("instaloader.Profile.from_iphone_struct") as mock_struct:
                    _fetch_old_posts(MagicMock(), tmp_path / "test.db")
        mock_struct.assert_not_called()
    finally:
        sched._stop_event.clear()


def test_download_account_fast_stops_when_stop_event_set(tmp_path):
    from api import scheduler as sched
    from api.scheduler import _download_account_fast

    (tmp_path / "111").mkdir()
    sched._stop_event.set()
    try:
        L = MagicMock()
        L.context.get_iphone_json.return_value = {"user": {}}
        profile = MagicMock()
        profile.get_posts.return_value = [MagicMock()]
        with patch("instaloader.Profile.from_iphone_struct", return_value=profile):
            with patch("api.scheduler.STORAGE_BASE", tmp_path):
                with patch("api.scheduler.index_account", return_value=0):
                    _download_account_fast(L, 1, "111", "alice", tmp_path / "test.db")
        L.download_post.assert_not_called()
    finally:
        sched._stop_event.clear()


def test_get_scheduler_status_stopped_when_no_task():
    from api import scheduler as sched
    from api.scheduler import get_scheduler_status

    original_task = sched._scheduler_task
    sched._scheduler_task = None
    try:
        with patch("api.scheduler.get_setting", return_value=None):
            status = get_scheduler_status()
        assert status["running"] is False
        assert status["next_run_at"] is None
    finally:
        sched._scheduler_task = original_task


def test_get_scheduler_status_returns_next_run_at():
    from api import scheduler as sched
    from api.scheduler import get_scheduler_status

    original_task = sched._scheduler_task
    sched._scheduler_task = None
    try:
        with patch("api.scheduler.get_setting", return_value="2026-05-16T10:30:00"):
            status = get_scheduler_status()
        assert status["next_run_at"] == "2026-05-16T10:30:00"
    finally:
        sched._scheduler_task = original_task


def test_post_has_video_pure_video_post():
    from api.scheduler import _post_has_video
    post = MagicMock()
    post.is_video = True
    assert _post_has_video(post) is True


def test_post_has_video_image_post():
    from api.scheduler import _post_has_video
    post = MagicMock()
    post.is_video = False
    post.typename = "GraphImage"
    assert _post_has_video(post) is False


def test_post_has_video_clean_carousel():
    from api.scheduler import _post_has_video
    node = MagicMock()
    node.is_video = False
    post = MagicMock()
    post.is_video = False
    post.typename = "GraphSidecar"
    post.get_sidecar_nodes.return_value = [node, node]
    assert _post_has_video(post) is False


def test_post_has_video_carousel_with_video_slide():
    from api.scheduler import _post_has_video
    img_node = MagicMock()
    img_node.is_video = False
    vid_node = MagicMock()
    vid_node.is_video = True
    post = MagicMock()
    post.is_video = False
    post.typename = "GraphSidecar"
    post.get_sidecar_nodes.return_value = [img_node, vid_node]
    assert _post_has_video(post) is True
