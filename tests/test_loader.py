import json
from unittest.mock import MagicMock, patch

import pytest

from api.db import get_setting, init_db


@pytest.fixture(autouse=True)
def reset_loader():
    import api.loader

    api.loader._loader = None
    yield
    api.loader._loader = None


def _make_mock_L():
    context = MagicMock()
    context.username = None

    L = MagicMock()
    L.context = context
    L.save_session.return_value = {"sessionid": "val", "csrftoken": "tok"}
    return L


def test_get_loader_returns_none_when_no_session_in_db(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with (
        patch("api.loader.DB_PATH", db),
        patch("api.loader._make_instaloader") as mock_make,
    ):
        from api.loader import get_loader

        result = get_loader()
    assert result is None
    mock_make.assert_not_called()


def test_get_loader_restores_cookies_without_test_login(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    from api.db import set_setting

    session_data = json.dumps({"sessionid": "sid", "csrftoken": "tok"})
    set_setting("session_id", "sid123", db)
    set_setting("cookies", session_data, db)
    set_setting("username", "alice", db)

    mock_L = _make_mock_L()
    with (
        patch("api.loader.DB_PATH", db),
        patch("api.loader._make_instaloader", return_value=mock_L),
    ):
        import api.loader

        api.loader._loader = None
        result = api.loader.get_loader()

    mock_L.test_login.assert_not_called()
    mock_L.load_session.assert_called_once_with("alice", {"sessionid": "sid", "csrftoken": "tok"})
    assert result is mock_L


def test_reload_session_calls_test_login_and_saves_to_db(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    mock_L = _make_mock_L()
    mock_L.test_login.return_value = "alice"

    with (
        patch("api.loader.DB_PATH", db),
        patch("api.loader._make_instaloader", return_value=mock_L),
    ):
        from api.loader import reload_session

        username = reload_session("newsid")

    assert username == "alice"
    mock_L.test_login.assert_called_once()
    assert get_setting("session_id", db) == "newsid"
    assert get_setting("username", db) == "alice"
    assert get_setting("cookies", db) is not None


def test_reload_session_raises_on_auth_failure(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    mock_L = _make_mock_L()
    mock_L.test_login.return_value = None

    with (
        patch("api.loader.DB_PATH", db),
        patch("api.loader._make_instaloader", return_value=mock_L),
    ):
        from api.loader import reload_session

        with pytest.raises(ValueError, match="Authentication failed"):
            reload_session("badsid")


def test_persist_session_cookies_saves_cookies_to_db(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    mock_L = _make_mock_L()

    with patch("api.loader.DB_PATH", db):
        import api.loader

        api.loader._loader = mock_L
        api.loader.persist_session_cookies()

    session_json = get_setting("cookies", db)
    assert session_json is not None
    assert json.loads(session_json) == {"sessionid": "val", "csrftoken": "tok"}


def test_persist_session_cookies_does_nothing_when_no_loader(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.loader.DB_PATH", db):
        import api.loader

        api.loader._loader = None
        api.loader.persist_session_cookies()  # must not raise
    assert get_setting("cookies", db) is None


def test_get_loader_calls_test_login_when_no_cookies(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    from api.db import set_setting

    set_setting("session_id", "newsid", db)
    # No cookies set

    mock_L = _make_mock_L()
    mock_L.test_login.return_value = "alice"

    with (
        patch("api.loader.DB_PATH", db),
        patch("api.loader._make_instaloader", return_value=mock_L),
    ):
        import api.loader

        api.loader._loader = None
        result = api.loader.get_loader()

    mock_L.test_login.assert_called_once()
    assert get_setting("username", db) == "alice"
    assert result is mock_L
