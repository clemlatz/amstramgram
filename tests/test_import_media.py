import json
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

from api.db import (
    _parse_gramoire_sidecar,
    import_gramoire_file,
    init_db,
    shortcode_exists,
)


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data))


def _gramoire_v12(
    shortcode="ABC123",
    kind="image",
    carousel_total=1,
    index=1,
    username="testuser",
    author_id="999",
    caption="hello",
    iso="2026-05-15T15:08:30.000Z",
) -> dict:
    return {
        "schema": "gramoire-media-metadata-v1.2",
        "exportedAt": "2026-05-26T22:06:01.069Z",
        "permalink": f"https://www.instagram.com/p/{shortcode}/",
        "filename": f"{shortcode}_{index}.jpg",
        "media": {
            "type": "post",
            "shortcode": shortcode,
            "id": "123456",
            "index": index,
            "extension": "jpg",
            "kind": kind,
            "carouselTotal": carousel_total,
        },
        "author": {"id": author_id, "username": username},
        "caption": caption,
        "altText": "",
        "hashtags": [],
        "timestamp": {"raw": 1778857710, "unix": 1778857710, "iso": iso},
    }


def _make_media_file(directory: Path, name: str = "ABC123_1.jpg") -> Path:
    p = directory / name
    p.write_bytes(b"\xff\xd8\xff" + b"\x00" * 100)
    return p


# --- _parse_gramoire_sidecar ---


def test_parse_gramoire_sidecar_image(tmp_path):
    p = tmp_path / "ABC123_1.json"
    _write_json(p, _gramoire_v12(shortcode="ABC123", kind="image", carousel_total=1))
    result = _parse_gramoire_sidecar(p)
    assert result["shortcode"] == "ABC123"
    assert result["post_type"] == "image"
    assert result["carousel_index"] == 1
    assert result["post_timestamp"] == "2026-05-15T15:08:30.000Z"
    assert result["caption"] == "hello"
    assert result["author_username"] == "testuser"
    assert result["author_id"] == "999"
    assert result["like_count"] is None
    assert result["comment_count"] is None
    assert result["location"] is None


def test_parse_gramoire_sidecar_video(tmp_path):
    p = tmp_path / "VID_1.json"
    _write_json(p, _gramoire_v12(kind="video", carousel_total=1))
    assert _parse_gramoire_sidecar(p)["post_type"] == "video"


def test_parse_gramoire_sidecar_carousel(tmp_path):
    p = tmp_path / "CAR_1.json"
    _write_json(p, _gramoire_v12(kind="image", carousel_total=3))
    assert _parse_gramoire_sidecar(p)["post_type"] == "carousel"


def test_parse_gramoire_sidecar_missing_file(tmp_path):
    result = _parse_gramoire_sidecar(tmp_path / "nonexistent.json")
    assert result["shortcode"] is None
    assert result["author_id"] is None


def test_parse_gramoire_sidecar_invalid_json(tmp_path):
    p = tmp_path / "bad.json"
    p.write_text("not json{{{")
    result = _parse_gramoire_sidecar(p)
    assert result["shortcode"] is None


# --- import_gramoire_file ---


def test_import_gramoire_file_moves_and_inserts(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    imports_dir = tmp_path / "imports"
    imports_dir.mkdir()
    storage = tmp_path / "storage"

    media = _make_media_file(imports_dir, "ABC123_1.jpg")
    json_path = imports_dir / "ABC123_1.json"
    _write_json(json_path, _gramoire_v12(shortcode="ABC123", author_id="999"))

    result = import_gramoire_file(media, json_path, storage, db)

    assert result == "imported"
    assert not media.exists()
    dest = storage / "999" / "ABC123_1.jpg"
    assert dest.exists()
    assert shortcode_exists("ABC123", db)


def test_import_gramoire_file_duplicate_returns_duplicate(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    imports_dir = tmp_path / "imports"
    imports_dir.mkdir()
    storage = tmp_path / "storage"

    media1 = _make_media_file(imports_dir, "ABC123_1.jpg")
    json1 = imports_dir / "ABC123_1.json"
    _write_json(json1, _gramoire_v12(shortcode="ABC123", author_id="999"))
    import_gramoire_file(media1, json1, storage, db)

    media2 = _make_media_file(imports_dir, "ABC123_1.jpg")
    json2 = imports_dir / "ABC123_1.json"
    _write_json(json2, _gramoire_v12(shortcode="ABC123", author_id="999"))
    result = import_gramoire_file(media2, json2, storage, db)

    assert result == "duplicate"
    assert media2.exists()


def test_import_gramoire_file_creates_account_inactive(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    imports_dir = tmp_path / "imports"
    imports_dir.mkdir()
    storage = tmp_path / "storage"

    media = _make_media_file(imports_dir, "XYZ_1.jpg")
    json_path = imports_dir / "XYZ_1.json"
    _write_json(
        json_path,
        _gramoire_v12(shortcode="XYZ111", username="newuser", author_id="42"),
    )
    import_gramoire_file(media, json_path, storage, db)

    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT active FROM accounts WHERE username = 'newuser'"
    ).fetchone()
    conn.close()
    assert row is not None
    assert row[0] == 0


# --- CLI ---


def _run_script(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "import_media.py"] + args,
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )


def test_cli_imports_pair(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    imports_dir = storage / "imports"
    imports_dir.mkdir(parents=True)

    media = _make_media_file(imports_dir, "ABC123_1.jpg")
    _write_json(
        imports_dir / "ABC123_1.json",
        _gramoire_v12(shortcode="ABC123", author_id="999"),
    )

    result = _run_script(["--db", str(db), "--storage", str(storage)])

    assert result.returncode == 0
    assert "1 imported" in result.stdout
    assert not media.exists()
    assert not (imports_dir / "ABC123_1.json").exists()


def test_cli_warns_missing_sidecar(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    imports_dir = storage / "imports"
    imports_dir.mkdir(parents=True)

    _make_media_file(imports_dir, "NOSIDECAR_1.jpg")

    result = _run_script(["--db", str(db), "--storage", str(storage)])

    assert result.returncode == 0
    assert "WARNING" in result.stdout
    assert "1 warning" in result.stdout
    assert (imports_dir / "NOSIDECAR_1.jpg").exists()


def test_cli_dry_run_does_not_move(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    imports_dir = storage / "imports"
    imports_dir.mkdir(parents=True)

    media = _make_media_file(imports_dir, "ABC123_1.jpg")
    _write_json(
        imports_dir / "ABC123_1.json",
        _gramoire_v12(shortcode="ABC123", author_id="999"),
    )

    result = _run_script(["--db", str(db), "--storage", str(storage), "--dry-run"])

    assert result.returncode == 0
    assert media.exists()
    assert not shortcode_exists("ABC123", db)
    assert (imports_dir / "ABC123_1.json").exists()


def test_cli_reports_duplicate(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    imports_dir = storage / "imports"
    imports_dir.mkdir(parents=True)

    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO accounts (username, platform_user_id, active) VALUES ('u', '999', 0)"
    )
    acc_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, shortcode) VALUES (?, 'f.jpg', '999/f.jpg', 'ABC123')",
        (acc_id,),
    )
    conn.commit()
    conn.close()

    _make_media_file(imports_dir, "ABC123_1.jpg")
    _write_json(
        imports_dir / "ABC123_1.json",
        _gramoire_v12(shortcode="ABC123", author_id="999"),
    )

    result = _run_script(["--db", str(db), "--storage", str(storage)])
    assert "1 duplicate" in result.stdout
