import base64
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from api.main import app


def _encode(filepath: str) -> str:
    return base64.urlsafe_b64encode(filepath.encode()).decode().rstrip("=")


@pytest.fixture()
def storage(tmp_path):
    s = tmp_path / "storage"
    s.mkdir()
    return s


@pytest.fixture()
def client(storage):
    with patch("api.routes.media.STORAGE_BASE", storage):
        yield TestClient(app)


def test_serves_jpeg(client, storage):
    (storage / "photo.jpg").write_bytes(b"\xff\xd8\xff\xe0")
    res = client.get(f"/api/media/{_encode('photo.jpg')}")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"


def test_serves_mp4(client, storage):
    (storage / "reel.mp4").write_bytes(b"\x00\x00\x00\x20ftyp")
    res = client.get(f"/api/media/{_encode('reel.mp4')}")
    assert res.status_code == 200
    assert res.headers["content-type"] == "video/mp4"


def test_unknown_extension_returns_404(client, storage):
    (storage / "file.gif").write_bytes(b"GIF89a")
    res = client.get(f"/api/media/{_encode('file.gif')}")
    assert res.status_code == 404


def test_nonexistent_file_returns_404(client, storage):
    res = client.get(f"/api/media/{_encode('ghost.jpg')}")
    assert res.status_code == 404


def test_path_traversal_returns_404(client, storage):
    res = client.get(f"/api/media/{_encode('../../etc/passwd')}")
    assert res.status_code == 404


def test_cache_control_header_present(client, storage):
    (storage / "img.jpg").write_bytes(b"\xff\xd8\xff\xe0")
    res = client.get(f"/api/media/{_encode('img.jpg')}")
    assert "max-age=86400" in res.headers.get("cache-control", "")


def test_range_request_returns_partial_content(client, storage):
    (storage / "reel.mp4").write_bytes(bytes(range(256)) * 40)  # 10240 bytes
    res = client.get(f"/api/media/{_encode('reel.mp4')}", headers={"Range": "bytes=0-9"})
    assert res.status_code == 206
    assert res.content == bytes(range(10))
    assert res.headers["content-range"] == "bytes 0-9/10240"
    assert res.headers["content-length"] == "10"
    assert res.headers["accept-ranges"] == "bytes"
