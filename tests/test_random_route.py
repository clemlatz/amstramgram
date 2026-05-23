import sqlite3
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.db import get_all_favorite_media_filepaths, init_db, upsert_rating
from api.main import app


def _insert_account(db, username, ig_id):
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO accounts (username, platform_user_id, active) VALUES (?, ?, 1)",
        (username, ig_id),
    )
    conn.commit()
    row_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return row_id


def _insert_media(db, account_id, filepath, extension, shortcode, post_timestamp):
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, post_timestamp)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (
            account_id,
            filepath.split("/")[-1],
            filepath,
            extension,
            shortcode,
            post_timestamp,
        ),
    )
    conn.commit()
    conn.close()


@pytest.fixture()
def client(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.routes.random.DB_PATH", db):
        yield TestClient(app), db


def test_get_random_favorites_returns_null_when_no_favorites(client):
    tc, _ = client
    res = tc.get("/api/random/favorites")
    assert res.status_code == 200
    assert res.json() == {"post": None}


def test_get_random_favorites_returns_favorited_post(client):
    tc, db = client
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/img.jpg", "jpg", "POST001", "2026-01-01T10:00:00Z")
    upsert_rating("POST001", "favorite", db)
    res = tc.get("/api/random/favorites")
    assert res.status_code == 200
    data = res.json()
    assert data["post"] is not None
    assert data["post"]["shortcode"] == "POST001"
    assert len(data["post"]["media"]) == 1
    assert data["post"]["media"][0]["type"] == "image"


def test_get_random_favorites_excludes_unrated_posts(client):
    tc, db = client
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/unrated.jpg", "jpg", "UNRATED", "2026-01-01T10:00:00Z")
    res = tc.get("/api/random/favorites")
    assert res.status_code == 200
    assert res.json() == {"post": None}


def test_get_all_favorite_media_filepaths_returns_favorited_only(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/img1.jpg", "jpg", "SC001", "2026-01-01T10:00:00Z")
    _insert_media(db, acc, "111/img2.jpg", "jpg", "SC002", "2026-01-02T10:00:00Z")
    _insert_media(db, acc, "111/img3.jpg", "jpg", "SC003", "2026-01-03T10:00:00Z")
    upsert_rating("SC001", "favorite", db)
    upsert_rating("SC002", "archive", db)

    paths = get_all_favorite_media_filepaths(db)
    assert paths == ["111/img1.jpg"]


def test_get_all_favorite_media_filepaths_includes_carousel(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/img1.jpg", "jpg", "SC001", "2026-01-01T10:00:00Z")
    _insert_media(db, acc, "111/img2.jpg", "jpg", "SC001", "2026-01-01T10:00:00Z")
    upsert_rating("SC001", "favorite", db)

    paths = get_all_favorite_media_filepaths(db)
    assert sorted(paths) == ["111/img1.jpg", "111/img2.jpg"]


def test_get_all_favorite_media_filepaths_excludes_unsupported_extensions(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/doc.pdf", "pdf", "SC001", "2026-01-01T10:00:00Z")
    upsert_rating("SC001", "favorite", db)

    paths = get_all_favorite_media_filepaths(db)
    assert paths == []


def test_favorites_media_urls_returns_empty_when_no_favorites(client):
    tc, _ = client
    res = tc.get("/api/favorites/media-urls")
    assert res.status_code == 200
    data = res.json()
    assert data["urls"] == []
    assert data["total"] == 0


def test_favorites_media_urls_returns_encoded_urls(client):
    tc, db = client
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/img1.jpg", "jpg", "SC001", "2026-01-01T10:00:00Z")
    _insert_media(db, acc, "111/img2.jpg", "jpg", "SC001", "2026-01-01T10:00:00Z")
    _insert_media(db, acc, "111/img3.jpg", "jpg", "SC002", "2026-01-02T10:00:00Z")
    upsert_rating("SC001", "favorite", db)
    # SC002 unrated

    res = tc.get("/api/favorites/media-urls")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert len(data["urls"]) == 2
    for url in data["urls"]:
        assert url.startswith("/api/media/")
