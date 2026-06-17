import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from api.db import init_db, upsert_following_accounts
from api.main import app


@pytest.fixture()
def db(tmp_path):
    path = tmp_path / "test.db"
    init_db(path)
    return path


@pytest.fixture()
def client(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.routes.accounts.DB_PATH", db):
        yield TestClient(app), db


def test_upsert_inserts_new_accounts(db):
    accounts = [
        {"username": "alice", "platform_user_id": "111"},
        {"username": "bob", "platform_user_id": "222"},
    ]
    added, new_usernames = upsert_following_accounts(accounts, db)
    assert added == 2
    assert set(new_usernames) == {"alice", "bob"}


def test_upsert_ignores_existing_username(db):
    accounts = [{"username": "alice", "platform_user_id": "111"}]
    upsert_following_accounts(accounts, db)
    added, new_usernames = upsert_following_accounts(accounts, db)
    assert added == 0
    assert new_usernames == []


def test_upsert_counts_only_new_rows(db):
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    added, new_usernames = upsert_following_accounts(
        [
            {"username": "alice", "platform_user_id": "111"},
            {"username": "bob", "platform_user_id": "222"},
        ],
        db,
    )
    assert added == 1
    assert new_usernames == ["bob"]


def test_upsert_sets_active_flag(db):
    import sqlite3

    upsert_following_accounts([{"username": "carol", "platform_user_id": "333"}], db)
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT active FROM accounts WHERE username = 'carol'"
    ).fetchone()
    conn.close()
    assert row[0] == 1


def test_upsert_stores_platform_user_id(db):
    import sqlite3

    upsert_following_accounts([{"username": "dave", "platform_user_id": "444"}], db)
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT platform_user_id FROM accounts WHERE username = 'dave'"
    ).fetchone()
    conn.close()
    assert row[0] == "444"


def test_upsert_empty_list_returns_zero(db):
    assert upsert_following_accounts([], db) == (0, [])


def test_upsert_stores_bio_fields(db):
    import sqlite3

    upsert_following_accounts(
        [
            {
                "username": "alice",
                "platform_user_id": "111",
                "bio": "Hello",
                "full_name": "Alice Smith",
                "external_url": "https://example.com",
            }
        ],
        db,
    )
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT bio, full_name, external_url FROM accounts WHERE username='alice'"
    ).fetchone()
    conn.close()
    assert row[0] == "Hello"
    assert row[1] == "Alice Smith"
    assert row[2] == "https://example.com"


def test_upsert_updates_bio_on_resync(db):
    import sqlite3

    upsert_following_accounts(
        [{"username": "alice", "platform_user_id": "111", "bio": "Old bio"}], db
    )
    upsert_following_accounts(
        [{"username": "alice", "platform_user_id": "111", "bio": "New bio"}], db
    )
    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT bio FROM accounts WHERE username='alice'").fetchone()
    conn.close()
    assert row[0] == "New bio"


def test_upsert_tolerates_missing_bio_fields(db):
    added, _ = upsert_following_accounts(
        [{"username": "alice", "platform_user_id": "111"}], db
    )
    assert added == 1  # must not raise


def test_upsert_updates_username_on_instagram_rename(db):
    import sqlite3

    upsert_following_accounts([{"username": "old_name", "platform_user_id": "111"}], db)
    upsert_following_accounts([{"username": "new_name", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT username FROM accounts WHERE platform_user_id = '111'"
    ).fetchone()
    conn.close()
    assert row[0] == "new_name"


# Route tests


def _make_loader(following_pages):
    """Build a mock Instaloader whose get_iphone_json returns the given pages in order."""
    mock_L = MagicMock()
    current_user_resp = {"user": {"pk": "99999"}}
    responses = [current_user_resp] + following_pages
    mock_L.context.get_iphone_json.side_effect = responses
    return mock_L


def test_sync_returns_400_when_no_session(client):
    tc, _ = client
    with patch("api.routes.accounts.get_loader", return_value=None):
        resp = tc.post("/api/accounts/import-following")
    assert resp.status_code == 400


def test_sync_inserts_accounts_and_returns_count(client):
    tc, _ = client
    page = {
        "users": [{"username": "alice", "pk": "111"}, {"username": "bob", "pk": "222"}]
    }
    mock_L = _make_loader([page])
    with patch("api.routes.accounts.get_loader", return_value=mock_L):
        resp = tc.post("/api/accounts/import-following")
    assert resp.status_code == 200
    assert resp.json() == {"added": 2}


def test_sync_paginates_until_no_next_cursor(client):
    tc, _ = client
    page1 = {"users": [{"username": "alice", "pk": "111"}], "next_max_id": "cursor_abc"}
    page2 = {"users": [{"username": "bob", "pk": "222"}]}
    mock_L = _make_loader([page1, page2])
    with patch("api.routes.accounts.get_loader", return_value=mock_L):
        resp = tc.post("/api/accounts/import-following")
    assert resp.status_code == 200
    assert resp.json() == {"added": 2}


def test_sync_returns_zero_when_all_accounts_exist(client):
    tc, db = client
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    page = {"users": [{"username": "alice", "pk": "111"}]}
    mock_L = _make_loader([page])
    with patch("api.routes.accounts.get_loader", return_value=mock_L):
        resp = tc.post("/api/accounts/import-following")
    assert resp.status_code == 200
    assert resp.json() == {"added": 0}


def test_sync_stores_bio_from_instagram_response(client):
    import sqlite3

    tc, db = client
    page = {
        "users": [
            {
                "username": "alice",
                "pk": "111",
                "biography": "My bio",
                "full_name": "Alice",
                "external_url": "https://alice.com",
            }
        ]
    }
    mock_L = _make_loader([page])
    with patch("api.routes.accounts.get_loader", return_value=mock_L):
        resp = tc.post("/api/accounts/import-following")
    assert resp.status_code == 200
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT bio, full_name, external_url FROM accounts WHERE username='alice'"
    ).fetchone()
    conn.close()
    assert row[0] == "My bio"
    assert row[1] == "Alice"
    assert row[2] == "https://alice.com"
