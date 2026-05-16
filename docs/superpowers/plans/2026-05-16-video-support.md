# Video Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.mp4` video support across the stack — serving, DB queries, API response shape, scheduler skipping, saved-posts reel filter, and frontend rendering with play/pause + mute toggle.

**Architecture:** Rename the image-serving route to `/api/media/` (adding `video/mp4`), extend DB queries to include `.mp4`, change both API endpoints from `images: string[]` to `media: [{url, type}]`, add a `_post_has_video` guard in the scheduler, allow only reels in saved-posts sync, and update both frontend pages to render `<video>` with mute toggle and context-appropriate autoplay.

**Tech Stack:** FastAPI, SQLite, SvelteKit (Svelte 5 runes), HTML5 `<video>`, pytest + unittest.mock

---

### Task 1: Rename image route → `/api/media/`, add `video/mp4` support

**Files:**
- Create: `api/routes/media.py`
- Delete: `api/routes/image.py`
- Modify: `api/main.py`
- Create: `tests/test_media_route.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_media_route.py
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/clement/Developer/amstramgram
python -m pytest tests/test_media_route.py -v
```

Expected: `ImportError` or `404` — `api.routes.media` does not exist yet.

- [ ] **Step 3: Create `api/routes/media.py`**

```python
import base64
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..config import STORAGE_BASE

router = APIRouter()

_CONTENT_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "png": "image/png",
    "mp4": "video/mp4",
}


@router.get("/media/{encoded}")
def get_media(encoded: str):
    try:
        padded = encoded + "=" * (-len(encoded) % 4)
        filepath = Path(base64.urlsafe_b64decode(padded).decode())
    except Exception:
        raise HTTPException(404)

    resolved = (STORAGE_BASE / filepath).resolve()
    if not resolved.is_relative_to(STORAGE_BASE.resolve()):
        raise HTTPException(404)
    if not resolved.exists():
        raise HTTPException(404)

    content_type = _CONTENT_TYPES.get(resolved.suffix[1:].lower())
    if not content_type:
        raise HTTPException(404)

    return Response(
        content=resolved.read_bytes(),
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
```

- [ ] **Step 4: Update `api/main.py` — swap `image` for `media`**

Replace:
```python
from .routes import accounts, feed, image, random, rate, settings, stats
```
with:
```python
from .routes import accounts, feed, media, random, rate, settings, stats
```

Replace:
```python
app.include_router(image.router, prefix="/api")
```
with:
```python
app.include_router(media.router, prefix="/api")
```

- [ ] **Step 5: Delete `api/routes/image.py`**

```bash
rm api/routes/image.py
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
python -m pytest tests/test_media_route.py -v
```

Expected: all 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add api/routes/media.py api/main.py tests/test_media_route.py
git rm api/routes/image.py
git commit -m "feat: rename image route to /api/media/, add video/mp4 support"
```

---

### Task 2: DB queries include `.mp4`; return `(filepath, extension)` tuples

**Files:**
- Modify: `api/db.py` — `get_recent_photos`, `get_random_neutral_photo`
- Modify: `tests/test_db.py` — add tests for both functions

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `tests/test_db.py`:

```python
import sqlite3 as _sqlite3  # already imported at top as sqlite3


def _insert_media(db: Path, account_id: int, filepath: str, extension: str,
                  shortcode: str = None, post_timestamp: str = None,
                  carousel_index: int = None) -> None:
    conn = _sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode,"
        " post_timestamp, carousel_index) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (account_id, filepath.split("/")[-1], filepath, extension,
         shortcode, post_timestamp, carousel_index),
    )
    conn.commit()
    conn.close()


def test_get_recent_photos_includes_mp4(tmp_path):
    from api.db import get_recent_photos
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/reel.mp4", "mp4",
                  shortcode="VID001", post_timestamp="2026-01-01T10:00:00Z")
    photos = get_recent_photos(db)
    assert len(photos) == 1
    assert photos[0]["media"] == [("111/reel.mp4", "mp4")]


def test_get_recent_photos_excludes_gif(tmp_path):
    from api.db import get_recent_photos
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/anim.gif", "gif",
                  shortcode="GIF001", post_timestamp="2026-01-01T10:00:00Z")
    assert get_recent_photos(db) == []


def test_get_recent_photos_groups_mixed_carousel(tmp_path):
    from api.db import get_recent_photos
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    ts = "2026-01-01T10:00:00Z"
    _insert_media(db, acc, "111/c_1.jpg", "jpg", shortcode="CAR001",
                  post_timestamp=ts, carousel_index=1)
    _insert_media(db, acc, "111/c_2.mp4", "mp4", shortcode="CAR001",
                  post_timestamp=ts, carousel_index=2)
    photos = get_recent_photos(db)
    assert len(photos) == 1
    media = photos[0]["media"]
    assert ("111/c_1.jpg", "jpg") in media
    assert ("111/c_2.mp4", "mp4") in media


def test_get_random_neutral_photo_includes_mp4(tmp_path):
    from api.db import get_random_neutral_photo
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/reel.mp4", "mp4",
                  shortcode="VID001", post_timestamp="2026-01-01T10:00:00Z")
    photo = get_random_neutral_photo(db)
    assert photo is not None
    assert photo["media"] == [("111/reel.mp4", "mp4")]


def test_get_random_neutral_photo_returns_none_when_all_rated(tmp_path):
    from api.db import get_random_neutral_photo, upsert_rating
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/reel.mp4", "mp4",
                  shortcode="VID001", post_timestamp="2026-01-01T10:00:00Z")
    upsert_rating("VID001", "archive", db)
    assert get_random_neutral_photo(db) is None
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
python -m pytest tests/test_db.py::test_get_recent_photos_includes_mp4 tests/test_db.py::test_get_random_neutral_photo_includes_mp4 -v
```

Expected: `KeyError: 'media'` or `AssertionError` — the functions don't return `media` yet.

- [ ] **Step 3: Update `get_recent_photos` in `api/db.py`**

Replace the entire `get_recent_photos` function (lines 396–426):

```python
def get_recent_photos(db_path: Path) -> list[dict]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute("""
            SELECT m.filepath, m.extension, m.post_timestamp, m.caption, m.shortcode,
                   r.archived_at, r.favorited_at, a.username AS account
            FROM media m
            JOIN accounts a ON a.id = m.account_id
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
            ORDER BY m.post_timestamp DESC, m.carousel_index ASC
        """).fetchall()
    finally:
        conn.close()

    posts: dict[str, dict] = {}
    for row in rows:
        key = f"{row['account']}/{row['post_timestamp']}" if row["post_timestamp"] else row["filepath"]
        if key not in posts:
            posts[key] = {
                "account": row["account"],
                "post_timestamp": row["post_timestamp"],
                "caption": row["caption"],
                "shortcode": row["shortcode"],
                "archived_at": row["archived_at"],
                "favorited_at": row["favorited_at"],
                "media": [],
            }
        posts[key]["media"].append((row["filepath"], row["extension"] or "jpg"))

    return list(posts.values())[:100]
```

- [ ] **Step 4: Update `get_random_neutral_photo` in `api/db.py`**

Replace the entire `get_random_neutral_photo` function (lines 360–393):

```python
def get_random_neutral_photo(db_path: Path) -> dict | None:
    conn = _conn(db_path, read_only=True)
    try:
        row = conn.execute("""
            SELECT DISTINCT m.shortcode FROM media m
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.shortcode IS NOT NULL AND r.shortcode IS NULL
              AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
            ORDER BY RANDOM() LIMIT 1
        """).fetchone()
        if not row:
            return None
        rows = conn.execute("""
            SELECT m.filepath, m.extension, m.post_timestamp, m.caption, m.shortcode,
                   a.username AS account
            FROM media m
            JOIN accounts a ON a.id = m.account_id
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.shortcode = ? AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
              AND r.shortcode IS NULL
            ORDER BY m.carousel_index ASC
        """, (row["shortcode"],)).fetchall()
    finally:
        conn.close()

    if not rows:
        return None
    first = rows[0]
    return {
        "account": first["account"],
        "post_timestamp": first["post_timestamp"],
        "caption": first["caption"],
        "shortcode": first["shortcode"],
        "media": [(r["filepath"], r["extension"] or "jpg") for r in rows],
    }
```

- [ ] **Step 5: Update `api/routes/feed.py` to use new DB return type**

Replace the entire file:

```python
import asyncio
import base64

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_recent_photos

router = APIRouter()


def _encode(filepath: str) -> str:
    return base64.urlsafe_b64encode(filepath.encode()).decode().rstrip("=")


def _media_type(ext: str) -> str:
    return "video" if ext == "mp4" else "image"


@router.get("/feed")
async def get_feed():
    photos = await asyncio.to_thread(get_recent_photos, DB_PATH)
    return JSONResponse({
        "photos": [
            {
                "account": p["account"],
                "caption": p["caption"],
                "post_timestamp": p["post_timestamp"],
                "shortcode": p["shortcode"],
                "archived_at": p["archived_at"],
                "favorited_at": p["favorited_at"],
                "media": [
                    {"url": f"/api/media/{_encode(fp)}", "type": _media_type(ext)}
                    for fp, ext in p["media"]
                ],
            }
            for p in photos
        ]
    })
```

- [ ] **Step 6: Update `api/routes/random.py` to use new DB return type**

Replace the entire file:

```python
import asyncio
import base64

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_random_neutral_photo

router = APIRouter()


def _encode(filepath: str) -> str:
    return base64.urlsafe_b64encode(filepath.encode()).decode().rstrip("=")


def _media_type(ext: str) -> str:
    return "video" if ext == "mp4" else "image"


@router.get("/random")
async def get_random():
    photo = await asyncio.to_thread(get_random_neutral_photo, DB_PATH)
    if not photo:
        return JSONResponse({"photo": None})
    return JSONResponse({
        "photo": {
            "account": photo["account"],
            "post_timestamp": photo["post_timestamp"],
            "shortcode": photo["shortcode"],
            "media": [
                {"url": f"/api/media/{_encode(fp)}", "type": _media_type(ext)}
                for fp, ext in photo["media"]
            ],
        }
    })
```

- [ ] **Step 7: Run all DB and route tests**

```bash
python -m pytest tests/test_db.py tests/test_media_route.py -v
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add api/db.py api/routes/feed.py api/routes/random.py tests/test_db.py
git commit -m "feat: include mp4 in DB queries; API returns media[{url,type}]"
```

---

### Task 3: Scheduler — skip posts that contain any video

**Files:**
- Modify: `api/scheduler.py`
- Modify: `tests/test_scheduler.py`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `tests/test_scheduler.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
python -m pytest tests/test_scheduler.py::test_post_has_video_pure_video_post -v
```

Expected: `ImportError` — `_post_has_video` does not exist yet.

- [ ] **Step 3: Add `_post_has_video` to `api/scheduler.py`**

Insert after the `_is_not_found` function (around line 73):

```python
def _post_has_video(post) -> bool:
    if post.is_video:
        return True
    if post.typename == "GraphSidecar":
        return any(node.is_video for node in post.get_sidecar_nodes())
    return False
```

- [ ] **Step 4: Apply the guard in `_download_account_fast`**

In `_download_account_fast`, inside the `for post in profile.get_posts():` loop, add the guard immediately after the `_stop_event.is_set()` check:

```python
for post in profile.get_posts():
    if _stop_event.is_set():
        return
    if _post_has_video(post):
        continue
    with download_lock:
        ...
```

- [ ] **Step 5: Apply the guard in `_fetch_old_posts`**

In `_fetch_old_posts`, inside the `for post in profile.get_posts():` loop, add after the `downloaded >= max_downloads` check:

```python
for post in profile.get_posts():
    if downloaded >= max_downloads:
        break
    if _post_has_video(post):
        continue
    with download_lock:
        ...
```

- [ ] **Step 6: Run scheduler tests**

```bash
python -m pytest tests/test_scheduler.py -v
```

Expected: all tests pass including the 4 new ones.

- [ ] **Step 7: Commit**

```bash
git add api/scheduler.py tests/test_scheduler.py
git commit -m "feat: scheduler skips posts containing any video"
```

---

### Task 4: Saved posts sync — download reels only

**Files:**
- Modify: `api/saved.py`
- Create: `tests/test_saved_posts.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_saved_posts.py
from unittest.mock import MagicMock, patch
from pathlib import Path

import pytest

from api.db import init_db


def _make_video_post(shortcode: str, product_type: str) -> MagicMock:
    post = MagicMock()
    post.shortcode = shortcode
    post.is_video = True
    post.product_type = product_type
    post.owner_username = "alice"
    post.owner_id = 111
    return post


def _run_sync(posts, tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    storage = tmp_path / "storage"
    storage.mkdir()

    L = MagicMock()
    profile = MagicMock()
    profile.get_saved_posts.return_value = posts

    with patch("api.saved.instaloader.Profile.own_profile", return_value=profile), \
         patch("api.saved._set_session_headers"), \
         patch("api.saved.record_saved_seen") as mock_seen, \
         patch("api.saved.upsert_account", return_value=(1, False)), \
         patch("api.saved.download_lock"), \
         patch("api.saved.index_account", return_value=0), \
         patch("api.saved.mark_as_saved_posts"), \
         patch("api.saved.time.sleep"):
        from api.saved import sync_saved_posts
        count, _ = sync_saved_posts(L, db, storage)
        return count, mock_seen


def test_sync_saved_skips_regular_feed_video(tmp_path):
    feed_video = _make_video_post("FV001", product_type="feed")
    count, mock_seen = _run_sync([feed_video], tmp_path)
    assert count == 0
    mock_seen.assert_called_once_with("FV001", tmp_path / "test.db")


def test_sync_saved_skips_igtv(tmp_path):
    igtv = _make_video_post("IG001", product_type="igtv")
    count, mock_seen = _run_sync([igtv], tmp_path)
    assert count == 0
    mock_seen.assert_called_once_with("IG001", tmp_path / "test.db")


def test_sync_saved_downloads_reel(tmp_path):
    reel = _make_video_post("REEL001", product_type="clips")
    count, mock_seen = _run_sync([reel], tmp_path)
    assert count == 1
    mock_seen.assert_not_called()
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
python -m pytest tests/test_saved_posts.py -v
```

Expected: `test_sync_saved_skips_regular_feed_video` passes (current code skips all videos), but `test_sync_saved_downloads_reel` fails (reels are currently skipped too).

- [ ] **Step 3: Update the video filter in `api/saved.py`**

Replace (lines 45–49):
```python
if post.is_video:
    logger.debug("sync-saved: skipping video %s", shortcode)
    record_saved_seen(shortcode, db_path)
    known_shortcodes.add(shortcode)
    continue
```

with:
```python
if post.is_video and getattr(post, "product_type", None) != "clips":
    logger.debug("sync-saved: skipping non-reel video %s", shortcode)
    record_saved_seen(shortcode, db_path)
    known_shortcodes.add(shortcode)
    continue
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_saved_posts.py -v
```

Expected: all 3 tests pass.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
python -m pytest -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add api/saved.py tests/test_saved_posts.py
git commit -m "feat: saved posts sync downloads reels only, skips other video types"
```

---

### Task 5: PostCard — video rendering with play/pause and mute toggle

**Files:**
- Modify: `frontend/src/lib/PostCard.svelte`
- Modify: `frontend/src/routes/+page.svelte`

No automated frontend tests. Verify manually after implementation.

- [ ] **Step 1: Replace `frontend/src/lib/PostCard.svelte`**

```svelte
<script>
  import 'swiper/css';
  import 'swiper/css/pagination';
  import { onMount } from 'svelte';

  let { post } = $props();

  const isCarousel = $derived(post.media.length > 1);

  let archived = $state(!!post.archived_at);
  let favorited = $state(!!post.favorited_at);
  let muted = $state(true);

  async function rate(action) {
    if (!post.shortcode) return;

    const prevArchived = archived;
    const prevFavorited = favorited;

    const effectiveAction =
      (action === 'archive' && archived) || (action === 'favorite' && favorited)
        ? 'clear'
        : action;

    if (effectiveAction === 'archive') {
      archived = true;
      favorited = false;
    } else if (effectiveAction === 'favorite') {
      favorited = true;
      archived = false;
    } else {
      archived = false;
      favorited = false;
    }

    try {
      const res = await fetch('/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcode: post.shortcode, action: effectiveAction }),
      });
      if (!res.ok) throw new Error('rate failed');
    } catch {
      archived = prevArchived;
      favorited = prevFavorited;
    }
  }

  let swiperEl = $state(null);

  const AVATAR_COLORS = ['#e91e63', '#9c27b0', '#2196f3', '#00bcd4', '#ff5722', '#ff9800'];

  function hideAvatarImage(e) {
    e.target.style.display = 'none';
  }

  function avatarColor(account) {
    let h = 0;
    for (const c of account) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function formatDate(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (mins < 60) return rtf.format(-mins, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    if (days < 7) return rtf.format(-days, 'day');
    return new Date(ts).toLocaleDateString('en', { day: 'numeric', month: 'short' });
  }

  function togglePlayPause(e) {
    const video = e.currentTarget;
    video.paused ? video.play() : video.pause();
  }

  function toggleMute(e) {
    e.stopPropagation();
    muted = !muted;
  }

  onMount(async () => {
    if (!isCarousel) return;
    const { default: Swiper } = await import('swiper');
    const { Pagination, Navigation } = await import('swiper/modules');
    const swiper = new Swiper(swiperEl, {
      modules: [Pagination, Navigation],
      pagination: {
        el: swiperEl.querySelector('.swiper-pagination'),
        clickable: false,
      },
      navigation: {
        nextEl: swiperEl.querySelector('.nav-next'),
        prevEl: swiperEl.querySelector('.nav-prev'),
      },
    });
    return () => swiper.destroy();
  });
</script>

<article class="post">
  <header class="post-header">
    <div class="avatar-ring">
      <div class="avatar-inner" style="background: {avatarColor(post.account)}">
        <img
          class="avatar-img"
          src="/api/accounts/{post.account}/avatar"
          alt={post.account}
          onerror={hideAvatarImage}
        />
        {post.account[0].toUpperCase()}
      </div>
    </div>
    <div class="post-meta">
      <div class="post-account">
        <a href="https://instagram.com/{post.account}" target="_blank">
          {post.account}
        </a>
      </div>
      <div class="post-date">{formatDate(post.post_timestamp)}</div>
    </div>
    <button
      class="header-fav-btn"
      class:active={favorited}
      aria-label={favorited ? 'Forget' : 'Remember'}
      aria-pressed={favorited}
      onclick={() => rate('favorite')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  </header>

  {#if isCarousel}
    <div class="swiper" bind:this={swiperEl}>
      <div class="swiper-wrapper">
        {#each post.media as item}
          <div class="swiper-slide">
            {#if item.type === 'video'}
              <div class="video-wrapper">
                <video src={item.url} loop bind:muted={muted} playsinline onclick={togglePlayPause}></video>
                <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                  {#if muted}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                  {:else}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  {/if}
                </button>
              </div>
            {:else}
              <img src={item.url} alt="" loading="lazy" />
            {/if}
          </div>
        {/each}
      </div>
      <div class="swiper-pagination"></div>
      <button class="nav-btn nav-prev" aria-label="Previous">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button class="nav-btn nav-next" aria-label="Next">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  {:else if post.media[0].type === 'video'}
    <div class="video-wrapper">
      <video class="post-video" src={post.media[0].url} loop bind:muted={muted} playsinline onclick={togglePlayPause}></video>
      <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
        {#if muted}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        {/if}
      </button>
    </div>
  {:else}
    <img class="post-image" src={post.media[0].url} alt="" loading="lazy" />
  {/if}

  <p class="post-caption">{post.caption}</p>
</article>

<style>
  .post {
    margin-bottom: 40px;
  }
  .post-header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    gap: 10px;
  }
  .avatar-ring {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    padding: 2px;
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
    flex-shrink: 0;
  }
  .avatar-inner {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid var(--color-avatar-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }
  .avatar-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
  }
  .post-meta {
    flex: 1;
  }
  .header-fav-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }
  .header-fav-btn svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: #8e8e8e;
    transition: fill 0.15s, stroke 0.15s;
  }
  .header-fav-btn.active svg {
    fill: #ed4956;
    stroke: #ed4956;
  }
  .post-account a {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.2;
    text-decoration: none;
  }
  .post-date {
    font-size: 12px;
    color: #8e8e8e;
    margin-top: 1px;
  }
  .post-image {
    width: 100%;
    display: block;
  }
  .post-caption {
    padding: 10px 14px 0;
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.5;
  }

  /* Video */
  .video-wrapper {
    position: relative;
  }
  .post-video {
    width: 100%;
    display: block;
    cursor: pointer;
  }
  .mute-btn {
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    -webkit-tap-highlight-color: transparent;
    z-index: 10;
  }
  .mute-btn svg {
    width: 16px;
    height: 16px;
    stroke: #fff;
  }

  /* Carousel */
  .swiper {
    position: relative;
    overflow: hidden;
  }
  .swiper :global(.swiper-slide img) {
    width: 100%;
    display: block;
  }
  .swiper :global(.swiper-slide video) {
    width: 100%;
    display: block;
    cursor: pointer;
  }
  .swiper :global(.swiper-pagination) {
    position: absolute;
    bottom: 12px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    pointer-events: none;
    z-index: 10;
  }
  .swiper :global(.swiper-pagination-bullet) {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fff;
    opacity: 0.5;
    margin: 0 !important;
    transition: opacity 0.2s;
    display: inline-block;
  }
  .swiper :global(.swiper-pagination-bullet-active) {
    opacity: 1;
  }
  .nav-btn {
    display: none;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--color-nav-btn);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.22);
    border: none;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    color: var(--color-nav-btn-text);
    padding: 0;
  }
  .nav-btn svg {
    width: 14px;
    height: 14px;
  }
  .nav-prev { left: 8px; }
  .nav-next { right: 8px; }
  @media (hover: hover) and (pointer: fine) {
    .swiper:hover .nav-btn:not(.swiper-button-disabled) {
      display: flex;
    }
  }

  /* kept for potential future action bar use */
  .action-bar {
    display: flex;
    border-top: 1px solid var(--color-border);
  }
  .action-btn {
    flex: 1;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg);
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .action-btn:first-child {
    border-right: 1px solid var(--color-border);
  }
  .action-btn svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: #8e8e8e;
    transition: fill 0.15s, stroke 0.15s;
  }
  .action-btn.active svg {
    fill: var(--color-text);
    stroke: var(--color-text);
  }
  .action-btn.favorite.active svg {
    fill: #ed4956;
    stroke: #ed4956;
  }
  .action-btn:disabled {
    cursor: default;
  }
  .action-btn:disabled svg {
    stroke: var(--color-border);
  }
</style>
```

- [ ] **Step 2: Update the key in `frontend/src/routes/+page.svelte`**

Replace:
```svelte
{#each data.photos as post (post.images[0])}
```
with:
```svelte
{#each data.photos as post (post.media[0].url)}
```

- [ ] **Step 3: Start the dev server and verify**

In one terminal:
```bash
python -m api
```
In another:
```bash
cd frontend && npm run dev
```

Open the feed page. Verify:
- Image posts still render correctly.
- If any `.mp4` files are in the DB, they show a video element, paused by default.
- Clicking a video plays/pauses it.
- Mute button is visible on the video, toggles the icon and audio state.
- Carousel with a video slide renders the video inside the Swiper.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/PostCard.svelte frontend/src/routes/+page.svelte
git commit -m "feat: PostCard renders video with play/pause and mute toggle"
```

---

### Task 6: Random page — video rendering with autoplay and mute toggle

**Files:**
- Modify: `frontend/src/routes/random/+page.svelte`

- [ ] **Step 1: Replace `frontend/src/routes/random/+page.svelte`**

```svelte
<script>
  import 'swiper/css';
  import 'swiper/css/pagination';

  let { data } = $props();

  let photo = $state(data.photo);
  let loading = $state(false);
  let visible = $state(true);
  let muted = $state(true);
  let swiperEl = $state(null);

  const isCarousel = $derived(photo?.media?.length > 1);

  $effect(() => {
    if (!swiperEl) return;

    let destroyed = false;
    let instance = null;

    (async () => {
      const { default: Swiper } = await import('swiper');
      const { Pagination, Navigation } = await import('swiper/modules');
      if (destroyed) return;
      instance = new Swiper(swiperEl, {
        modules: [Pagination, Navigation],
        pagination: { el: swiperEl.querySelector('.swiper-pagination'), clickable: false },
        navigation: {
          nextEl: swiperEl.querySelector('.nav-next'),
          prevEl: swiperEl.querySelector('.nav-prev'),
        },
      });
    })();

    return () => {
      destroyed = true;
      instance?.destroy();
    };
  });

  const AVATAR_COLORS = ['#e91e63', '#9c27b0', '#2196f3', '#00bcd4', '#ff5722', '#ff9800'];

  function hideAvatarImage(e) {
    e.target.style.display = 'none';
  }

  function avatarColor(account) {
    let h = 0;
    for (const c of account) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function formatDate(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    const currentYear = new Date().getFullYear();
    const dateYear = new Date(ts).getFullYear();

    if (mins < 60) return rtf.format(-mins, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    if (days < 7) return rtf.format(-days, 'day');
    if (currentYear === dateYear) return new Date(ts).toLocaleDateString('en', { day: 'numeric', month: 'long' });
    return new Date(ts).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function togglePlayPause(e) {
    const video = e.currentTarget;
    video.paused ? video.play() : video.pause();
  }

  function toggleMute(e) {
    e.stopPropagation();
    muted = !muted;
  }

  async function rate(action) {
    if (!photo || loading) return;
    loading = true;
    visible = false;

    const shortcode = photo.shortcode;

    await Promise.all([
      new Promise(r => setTimeout(r, 200)),
      fetch('/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcode, action }),
      }),
    ]);

    try {
      const res = await fetch('/api/random');
      const { photo: next } = await res.json();
      photo = next;
      muted = true;
    } catch {
      photo = null;
    }

    visible = true;
    loading = false;
  }
</script>

{#if photo}
  <div class="page">
    <article class="card" class:fade={!visible}>
      <header class="post-header">
        <div class="avatar-ring">
          <div class="avatar-inner" style="background: {avatarColor(photo.account)}">
            <img
              class="avatar-img"
              src="/api/accounts/{photo.account}/avatar"
              alt={photo.account}
              onerror={hideAvatarImage}
            />
            {photo.account[0].toUpperCase()}
          </div>
        </div>
        <div class="post-meta">
          <div class="post-account">
            <a href="https://www.instagram.com/{photo.account}" target="_blank">
              {photo.account}
            </a>
          </div>
          <div class="post-date">{formatDate(photo.post_timestamp)}</div>
        </div>
      </header>

      {#if isCarousel}
        {#key photo.shortcode}
        <div class="swiper" bind:this={swiperEl}>
          <div class="swiper-wrapper">
            {#each photo.media as item}
              <div class="swiper-slide">
                {#if item.type === 'video'}
                  <div class="video-wrapper">
                    <video src={item.url} loop bind:muted={muted} playsinline autoplay onclick={togglePlayPause}></video>
                    <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                      {#if muted}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                          <line x1="23" y1="9" x2="17" y2="15"/>
                          <line x1="17" y1="9" x2="23" y2="15"/>
                        </svg>
                      {:else}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        </svg>
                      {/if}
                    </button>
                  </div>
                {:else}
                  <img src={item.url} alt="" loading="lazy" />
                {/if}
              </div>
            {/each}
          </div>
          <div class="swiper-pagination"></div>
          <button class="nav-btn nav-prev" aria-label="Previous">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button class="nav-btn nav-next" aria-label="Next">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        {/key}
      {:else if photo.media[0].type === 'video'}
        {#key photo.shortcode}
          <div class="video-wrapper">
            <video class="post-video" src={photo.media[0].url} loop bind:muted={muted} playsinline autoplay onclick={togglePlayPause}></video>
            <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              {#if muted}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              {/if}
            </button>
          </div>
        {/key}
      {:else}
        <img class="post-image" src={photo.media[0].url} alt="" />
      {/if}
    </article>

    <div class="actions">
      <button class="btn forget" disabled={loading} onclick={() => rate('archive')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Forget
      </button>
      <button class="btn remember" disabled={loading} onclick={() => rate('favorite')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        Remember
      </button>
    </div>
  </div>
{:else}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.75"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
      <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/>
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/>
    </svg>
    <p class="empty-title">All caught up!</p>
    <p class="empty-sub">Come back later for new photos.</p>
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    max-width: 470px;
    margin: 0 auto;
    padding: 16px 0 0;
    gap: 16px;
  }

  .card {
    transition: opacity 0.2s ease;
  }

  .card.fade {
    opacity: 0;
  }

  .post-header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    gap: 10px;
  }

  .avatar-ring {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    padding: 2px;
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
    flex-shrink: 0;
  }

  .avatar-inner {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid var(--color-avatar-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .avatar-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
  }

  .post-meta {
    flex: 1;
  }

  .post-account a {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.2;
    text-decoration: none;
  }

  .post-date {
    font-size: 12px;
    color: #8e8e8e;
    margin-top: 1px;
  }

  .post-image {
    width: 100%;
    display: block;
  }

  /* Video */
  .video-wrapper {
    position: relative;
  }

  .post-video {
    width: 100%;
    display: block;
    cursor: pointer;
  }

  .mute-btn {
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    -webkit-tap-highlight-color: transparent;
    z-index: 10;
  }

  .mute-btn svg {
    width: 16px;
    height: 16px;
    stroke: #fff;
  }

  /* Carousel */
  .swiper {
    position: relative;
    overflow: hidden;
  }

  .swiper :global(.swiper-slide img) {
    width: 100%;
    display: block;
  }

  .swiper :global(.swiper-slide video) {
    width: 100%;
    display: block;
    cursor: pointer;
  }

  .swiper :global(.swiper-pagination) {
    position: absolute;
    bottom: 12px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    pointer-events: none;
    z-index: 10;
  }

  .swiper :global(.swiper-pagination-bullet) {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fff;
    opacity: 0.5;
    margin: 0 !important;
    transition: opacity 0.2s;
    display: inline-block;
  }

  .swiper :global(.swiper-pagination-bullet-active) {
    opacity: 1;
  }

  .nav-btn {
    display: none;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--color-nav-btn);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.22);
    border: none;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    color: var(--color-nav-btn-text);
    padding: 0;
  }

  .nav-btn svg {
    width: 14px;
    height: 14px;
  }

  .nav-prev { left: 8px; }
  .nav-next { right: 8px; }

  @media (hover: hover) and (pointer: fine) {
    .swiper:hover .nav-btn:not(.swiper-button-disabled) {
      display: flex;
    }
  }

  .actions {
    display: flex;
    gap: 12px;
    padding: 0 16px 16px;
    flex-shrink: 0;
  }

  .btn {
    flex: 1;
    height: 56px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.15s, transform 0.1s;
  }

  .btn:active {
    transform: scale(0.96);
    opacity: 0.85;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: default;
    transform: none;
  }

  .btn svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .forget { background: #8B2035; }
  .remember { background: #2D6A4F; }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: calc(100dvh - 49px - env(safe-area-inset-bottom, 0px));
    padding: 32px;
    text-align: center;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--color-empty-icon);
  }

  .empty-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text);
  }

  .empty-sub {
    font-size: 14px;
    color: #8e8e8e;
  }
</style>
```

- [ ] **Step 2: Verify in the browser**

With the dev server running, open the random page. Verify:
- Image posts still show correctly with Forget/Remember buttons.
- If a video post appears: it autoplays muted, loops, click pauses/resumes, mute button toggles audio.
- After rating (Forget/Remember), muted state resets to true on the next photo.
- Carousel with a video slide: video autoplays, mute button visible.
- "All caught up" screen still appears when no unrated photos remain.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/random/+page.svelte
git commit -m "feat: random page renders video with autoplay and mute toggle"
```

---

## Self-review checklist

- [x] **Task 1** covers spec item: rename `/api/image/` → `/api/media/`, add `video/mp4`
- [x] **Task 2** covers: DB includes mp4; API response is `media: [{url, type}]` on both endpoints
- [x] **Task 3** covers: scheduler skips any post containing video (pure or carousel)
- [x] **Task 4** covers: saved posts sync downloads reels only (`product_type == 'clips'`)
- [x] **Task 5** covers: feed videos paused by default, click to play/pause, mute toggle
- [x] **Task 6** covers: random page videos autoplay muted, click to play/pause, mute resets on photo change
- [x] All tasks use the same `media: [{url, type}]` shape consistently — no `images` references remain
- [x] `_post_has_video` defined in Task 3 is a module-level function, importable in tests
- [x] `muted = true` reset in `rate()` (Task 6, Step 1) matches spec requirement "mute state resets when photo changes"
- [x] No placeholders or TBDs
