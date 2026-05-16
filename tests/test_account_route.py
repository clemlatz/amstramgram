from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from api.db import init_db, set_setting, upsert_following_accounts, save_account_profile_pic
from api.main import app


@pytest.fixture()
def client(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.routes.settings.DB_PATH", db):
        yield TestClient(app), db


def test_get_settings_returns_nulls_when_no_session(client):
    tc, _ = client
    resp = tc.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] is None
    assert data["session_id"] is None
    assert data["user_agent"] is None


def test_get_settings_returns_stored_values(client):
    tc, db = client
    set_setting("username", "alice", db)
    set_setting("session_id", "sid123", db)
    resp = tc.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "alice"
    assert data["session_id"] == "sid123"


def test_post_session_returns_username_on_success(client):
    tc, _ = client
    with patch("api.routes.settings.reload_session", return_value="alice"):
        resp = tc.post("/api/settings/session", json={"session_id": "newsid"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"


def test_post_session_returns_401_on_auth_failure(client):
    tc, _ = client
    with patch("api.routes.settings.reload_session", side_effect=ValueError("Authentication failed")):
        resp = tc.post("/api/settings/session", json={"session_id": "badsid"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Authentication failed"


def test_get_settings_includes_scheduler_fields(client):
    tc, _ = client
    with patch("api.routes.settings.get_scheduler_status", return_value={"running": False, "next_run_at": None}):
        resp = tc.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["scheduler_running"] is False
    assert data["next_run_at"] is None


def test_post_scheduler_start_returns_running_true(client):
    tc, _ = client
    with patch("api.routes.settings.start_scheduler", new_callable=AsyncMock) as mock_start:
        resp = tc.post("/api/settings/scheduler/start")
    assert resp.status_code == 200
    assert resp.json() == {"running": True}
    mock_start.assert_called_once()


def test_post_scheduler_stop_returns_running_false(client):
    tc, _ = client
    with patch("api.routes.settings.stop_scheduler", new_callable=AsyncMock) as mock_stop:
        resp = tc.post("/api/settings/scheduler/stop")
    assert resp.status_code == 200
    assert resp.json() == {"running": False}
    mock_stop.assert_called_once()


@pytest.fixture()
def avatar_client(tmp_path):
    db = tmp_path / "test.db"
    storage = tmp_path / "storage"
    storage.mkdir()
    init_db(db)
    with (
        patch("api.routes.accounts.DB_PATH", db),
        patch("api.routes.accounts.STORAGE_BASE", storage),
    ):
        yield TestClient(app), db, storage


def test_avatar_returns_404_when_account_unknown(avatar_client):
    tc, db, storage = avatar_client
    resp = tc.get("/api/accounts/nobody/avatar")
    assert resp.status_code == 404


def test_avatar_returns_404_when_pic_not_downloaded(avatar_client):
    tc, db, storage = avatar_client
    upsert_following_accounts([{"username": "alice", "platform_user_id": "123"}], db)
    resp = tc.get("/api/accounts/alice/avatar")
    assert resp.status_code == 404


def test_avatar_returns_404_when_file_missing_on_disk(avatar_client):
    tc, db, storage = avatar_client
    upsert_following_accounts([{"username": "alice", "platform_user_id": "123"}], db)
    save_account_profile_pic("123", "123/profile.jpg", db)  # path stored but file never written
    resp = tc.get("/api/accounts/alice/avatar")
    assert resp.status_code == 404


def test_avatar_returns_jpeg_when_pic_exists(avatar_client):
    tc, db, storage = avatar_client
    upsert_following_accounts([{"username": "alice", "platform_user_id": "123"}], db)
    pic_dir = storage / "123"
    pic_dir.mkdir()
    (pic_dir / "profile.jpg").write_bytes(b"\xff\xd8\xff\xe0")  # minimal JPEG header
    save_account_profile_pic("123", "123/profile.jpg", db)
    resp = tc.get("/api/accounts/alice/avatar")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/jpeg")
