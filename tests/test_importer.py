import json
from pathlib import Path

import pytest

from api.importer import count_pending_imports, run_import
from api.db import init_db


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data))


def _gramoire_v12(
    shortcode="ABC123",
    kind="image",
    carousel_total=1,
    index=1,
    username="testuser",
    author_id="999",
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
        "caption": "hello",
        "altText": "",
        "hashtags": [],
        "timestamp": {"raw": 1778857710, "unix": 1778857710, "iso": "2026-05-15T15:08:30.000Z"},
    }


def _make_media_file(directory: Path, name: str = "ABC123_1.jpg") -> Path:
    p = directory / name
    p.write_bytes(b"\xff\xd8\xff" + b"\x00" * 100)
    return p


# --- count_pending_imports ---


def test_count_pending_imports_no_dir(tmp_path):
    assert count_pending_imports(tmp_path) == 0


def test_count_pending_imports_empty_dir(tmp_path):
    (tmp_path / "imports").mkdir()
    assert count_pending_imports(tmp_path) == 0


def test_count_pending_imports_counts_paired_files(tmp_path):
    imports = tmp_path / "imports"
    imports.mkdir()
    _make_media_file(imports, "A_1.jpg")
    _write_json(imports / "A_1.json", _gramoire_v12(shortcode="A"))
    _make_media_file(imports, "B_1.jpg")
    _write_json(imports / "B_1.json", _gramoire_v12(shortcode="B"))
    assert count_pending_imports(tmp_path) == 2


def test_count_pending_imports_excludes_media_without_sidecar(tmp_path):
    imports = tmp_path / "imports"
    imports.mkdir()
    _make_media_file(imports, "A_1.jpg")  # no .json
    assert count_pending_imports(tmp_path) == 0


def test_count_pending_imports_excludes_non_media(tmp_path):
    imports = tmp_path / "imports"
    imports.mkdir()
    (imports / "readme.txt").write_text("hi")
    (imports / "readme.json").write_text("{}")
    assert count_pending_imports(tmp_path) == 0


# --- run_import (returns dict) ---


def test_run_import_returns_counts(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    imports = storage / "imports"
    imports.mkdir(parents=True)

    _make_media_file(imports, "A_1.jpg")
    _write_json(imports / "A_1.json", _gramoire_v12(shortcode="A", author_id="1"))

    result = run_import(db, storage)

    assert result == {"imported": 1, "duplicates": 0, "warnings": 0}
    assert not (imports / "A_1.jpg").exists()
    assert not (imports / "A_1.json").exists()


def test_run_import_counts_warning_for_missing_sidecar(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    imports = storage / "imports"
    imports.mkdir(parents=True)

    _make_media_file(imports, "NOSIDECAR_1.jpg")

    result = run_import(db, storage)
    assert result == {"imported": 0, "duplicates": 0, "warnings": 1}
    assert (imports / "NOSIDECAR_1.jpg").exists()


def test_run_import_counts_duplicate(tmp_path):
    import sqlite3
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    imports = storage / "imports"
    imports.mkdir(parents=True)

    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO accounts (username, platform_user_id, active) VALUES ('u', '999', 0)"
    )
    acc_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, shortcode) VALUES (?, 'f.jpg', '999/f.jpg', 'DUP01')",
        (acc_id,),
    )
    conn.commit()
    conn.close()

    _make_media_file(imports, "DUP01_1.jpg")
    _write_json(imports / "DUP01_1.json", _gramoire_v12(shortcode="DUP01", author_id="999"))

    result = run_import(db, storage)
    assert result["duplicates"] == 1
    assert not (imports / "DUP01_1.jpg").exists()


def test_run_import_no_imports_dir(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    result = run_import(db, tmp_path)
    assert result == {"imported": 0, "duplicates": 0, "warnings": 0}
