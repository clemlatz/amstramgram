from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


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
            with patch("api.scheduler._lognormal_delay", return_value=600):
                await _wait_until_window()
    mock_sleep.assert_called_once()
    delay = mock_sleep.call_args[0][0]
    # 2am → 7am = 18000s base + 600s jitter
    assert 18500 < delay < 18700


@pytest.mark.asyncio
async def test_wait_until_window_sleeps_after_23h():
    from api.scheduler import _wait_until_window

    with patch("api.scheduler.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 5, 10, 23, 30, 0)
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            with patch("api.scheduler._lognormal_delay", return_value=600):
                await _wait_until_window()
    mock_sleep.assert_called_once()
    delay = mock_sleep.call_args[0][0]
    # 23:30 → 7am next day = 27000s base + 600s jitter
    assert 27500 < delay < 27700


def test_fetch_new_posts_fully_imported_accounts_get_unlimited_max_posts(tmp_path):
    from api.scheduler import _fetch_new_posts

    db = tmp_path / "test.db"
    active_accounts = [
        (1, "111", "alice", 1),  # fully imported — max_posts=None
        (2, "222", "bob", 0),  # not fully imported — max_posts=IMPORT_MAX_RECENT_POSTS
    ]

    with patch("api.scheduler._import_account", return_value=0) as mock_dl:
        with patch("api.scheduler._sleep"):
            _fetch_new_posts(MagicMock(), active_accounts, db)

    calls_by_username = {
        c.args[3]: c.kwargs.get("max_posts") for c in mock_dl.call_args_list
    }
    assert calls_by_username["alice"] is None
    assert calls_by_username["bob"] is not None


def test_fetch_new_posts_not_fully_imported_only_still_runs(tmp_path):
    from api.scheduler import _fetch_new_posts
    from api.config import IMPORT_MAX_RECENT_POSTS

    db = tmp_path / "test.db"
    active_accounts = [(1, "111", "alice", 0)]  # not fully imported — included with cap

    with patch("api.scheduler._import_account", return_value=0) as mock_dl:
        _fetch_new_posts(MagicMock(), active_accounts, db)

    mock_dl.assert_called_once()
    assert mock_dl.call_args.kwargs.get("max_posts") == IMPORT_MAX_RECENT_POSTS


def test_fetch_new_posts_calls_import_for_all_accounts(tmp_path):
    from api.scheduler import _fetch_new_posts

    db = tmp_path / "test.db"
    active_accounts = [
        (1, "111", "alice", 1),
        (2, "222", "bob", 1),
        (3, "333", "carol", 0),  # not fully imported — included with max_posts cap
    ]

    with patch("api.scheduler._import_account", return_value=0) as mock_dl:
        with patch("api.scheduler._sleep"):
            _fetch_new_posts(MagicMock(), active_accounts, db)

    called_usernames = {c.args[3] for c in mock_dl.call_args_list}
    assert called_usernames == {"alice", "bob", "carol"}


def test_import_account_stops_on_existing_post(tmp_path):
    from api.scheduler import _import_account

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
        with patch("api.scheduler.MEDIA_BASE", tmp_path):
            with patch("api.scheduler.index_account", return_value=0):
                with patch("time.sleep"):
                    _import_account(L, 1, "111", "alice", tmp_path / "test.db")

    assert L.download_post.call_count == 2


def test_fetch_old_posts_marks_fully_imported_when_no_new_posts(tmp_path):
    from api.scheduler import _fetch_old_posts

    db = tmp_path / "test.db"
    (tmp_path / "111").mkdir()

    with patch("api.scheduler.IMPORT_ENABLE_BACKFILL", True):
        with patch(
            "api.scheduler.get_not_fully_imported_accounts", return_value=[(1, "111", "alice")]
        ):
            with patch("api.scheduler.mark_account_fully_imported") as mock_mark:
                with patch("api.scheduler.index_account", return_value=0):
                    with patch("api.scheduler.MEDIA_BASE", tmp_path):
                        L = MagicMock()
                        L.context.get_iphone_json.return_value = {"user": {}}
                        profile = MagicMock()
                        profile.get_posts.return_value = []
                        with patch(
                            "instaloader.Profile.from_iphone_struct",
                            return_value=profile,
                        ):
                            _fetch_old_posts(L, db)
    mock_mark.assert_called_once_with(1, db)


def test_fetch_old_posts_selects_max_3_accounts(tmp_path):
    from api.scheduler import _fetch_old_posts

    db = tmp_path / "test.db"
    for i in range(10):
        (tmp_path / str(i)).mkdir()

    not_imported = [(i, str(i), f"user{i}") for i in range(10)]

    with patch("api.scheduler.IMPORT_ENABLE_BACKFILL", True):
        with patch("api.scheduler.get_not_fully_imported_accounts", return_value=not_imported):
            with patch("api.scheduler.mark_account_fully_imported"):
                with patch("api.scheduler.index_account", return_value=0):
                    with patch("api.scheduler.MEDIA_BASE", tmp_path):
                        with patch("api.scheduler._sleep"):
                            L = MagicMock()
                            profile = MagicMock()
                            profile.get_posts.return_value = []
                            with patch(
                                "instaloader.Profile.from_iphone_struct",
                                return_value=profile,
                            ) as mock_from_struct:
                                _fetch_old_posts(L, db)
                            assert mock_from_struct.call_count <= 3


def test_fetch_new_posts_stops_when_stop_event_set(tmp_path):
    from api import scheduler as sched
    from api.scheduler import _fetch_new_posts

    sched._stop_event.set()
    try:
        active_accounts = [(1, "111", "alice", 1)]
        with patch("api.scheduler._import_account") as mock_dl:
            _fetch_new_posts(MagicMock(), active_accounts, tmp_path / "test.db")
        mock_dl.assert_not_called()
    finally:
        sched._stop_event.clear()


def test_fetch_old_posts_stops_when_stop_event_set(tmp_path):
    from api import scheduler as sched
    from api.scheduler import _fetch_old_posts

    sched._stop_event.set()
    try:
        with patch("api.scheduler.IMPORT_ENABLE_BACKFILL", True):
            with patch(
                "api.scheduler.get_not_fully_imported_accounts",
                return_value=[(1, "111", "alice")],
            ):
                with patch("instaloader.Profile.from_iphone_struct") as mock_struct:
                    _fetch_old_posts(MagicMock(), tmp_path / "test.db")
        mock_struct.assert_not_called()
    finally:
        sched._stop_event.clear()


def test_import_account_stops_when_stop_event_set(tmp_path):
    from api import scheduler as sched
    from api.scheduler import _import_account

    (tmp_path / "111").mkdir()
    sched._stop_event.set()
    try:
        L = MagicMock()
        L.context.get_iphone_json.return_value = {"user": {}}
        profile = MagicMock()
        profile.get_posts.return_value = [MagicMock()]
        with patch("instaloader.Profile.from_iphone_struct", return_value=profile):
            with patch("api.scheduler.MEDIA_BASE", tmp_path):
                with patch("api.scheduler.index_account", return_value=0):
                    _import_account(L, 1, "111", "alice", tmp_path / "test.db")
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


@pytest.mark.asyncio
async def test_run_manual_cycle_runs_cycle_and_releases_flag():
    from api import scheduler as sched
    from api.scheduler import run_manual_cycle

    with patch("api.scheduler._run_cycle", return_value={"alice": 2}):
        result = await run_manual_cycle()

    assert result == {"alice": 2}
    assert sched._cycle_running is False


@pytest.mark.asyncio
async def test_run_manual_cycle_rejects_when_already_running():
    from api import scheduler as sched
    from api.scheduler import run_manual_cycle

    sched._cycle_running = True
    try:
        with pytest.raises(RuntimeError):
            await run_manual_cycle()
    finally:
        sched._cycle_running = False


@pytest.mark.asyncio
async def test_run_manual_cycle_disables_scheduler_on_session_invalidated():
    from api import scheduler as sched
    from api.scheduler import SessionExpiredException, run_manual_cycle

    with patch("api.scheduler._run_cycle", side_effect=SessionExpiredException("logged out")):
        with patch("api.scheduler.set_setting") as mock_set:
            with patch("api.scheduler.send_telegram_alert") as mock_alert:
                with pytest.raises(SessionExpiredException):
                    await run_manual_cycle()

    mock_set.assert_called_once_with("scheduler_enabled", "false", sched.DB_PATH)
    mock_alert.assert_called_once()
    assert sched._cycle_running is False


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
