import sqlite3 as _sqlite3
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.db import init_db, upsert_following_accounts
from api.main import app


@pytest.fixture()
def client(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.routes.userscript.DB_PATH", db):
        yield TestClient(app), db


def _insert_account_media(
    db, account_id: int, shortcode: str, ts: str, filepath: str
) -> None:
    conn = _sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, post_timestamp)"
        " VALUES (?, ?, ?, 'jpg', ?, ?)",
        (account_id, f"{shortcode}.jpg", filepath, shortcode, ts),
    )
    conn.commit()
    conn.close()


def test_get_account_posts_returns_empty_for_unknown(client):
    tc, _ = client
    resp = tc.get("/api/userscript/accounts/nobody/posts")
    assert resp.status_code == 200
    assert resp.json() == {"posts": []}


def test_get_account_posts_returns_posts(client):
    tc, db = client
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = _sqlite3.connect(str(db))
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username='alice'"
    ).fetchone()[0]
    conn.close()
    _insert_account_media(db, account_id, "sc1", "2024-01-01T00:00:00Z", "111/sc1.jpg")
    resp = tc.get("/api/userscript/accounts/alice/posts")
    assert resp.status_code == 200
    posts = resp.json()["posts"]
    assert len(posts) == 1
    assert posts[0]["shortcode"] == "sc1"
    assert posts[0]["media"][0]["url"].startswith("/api/media/")


def test_get_shortcodes_returns_empty_list_when_no_media(client):
    tc, _ = client
    resp = tc.get("/api/userscript/shortcodes")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_shortcodes_returns_sorted_known_shortcodes(client):
    tc, db = client
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = _sqlite3.connect(str(db))
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username='alice'"
    ).fetchone()[0]
    conn.close()
    _insert_account_media(db, account_id, "sc2", "2024-01-01T00:00:00Z", "111/sc2.jpg")
    _insert_account_media(db, account_id, "sc1", "2024-01-02T00:00:00Z", "111/sc1.jpg")
    resp = tc.get("/api/userscript/shortcodes")
    assert resp.status_code == 200
    assert resp.json() == ["sc1", "sc2"]
