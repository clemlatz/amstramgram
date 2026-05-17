# Favorites Random Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mode toggle to `/random` so users can browse only their favorited posts in random order, with Forget and Next actions.

**Architecture:** New `get_random_favorite_post` db function mirrors `get_random_neutral_post` but filters on `favorited_at IS NOT NULL`. A new `GET /api/random/favorites` route exposes it. The frontend adds a segmented control that persists mode in `localStorage` and switches the fetch endpoint accordingly.

**Tech Stack:** Python / FastAPI / SQLite (backend), SvelteKit adapter-static SPA (frontend), pytest (backend tests).

---

## Files

| File | Change |
|---|---|
| `api/db.py` | Add `get_random_favorite_post` function |
| `api/routes/random.py` | Add `GET /api/random/favorites` handler, import new db fn |
| `tests/test_db.py` | Add 3 tests for `get_random_favorite_post` |
| `tests/test_random_route.py` | New file — 3 tests for the new endpoint |
| `frontend/src/routes/random/+page.js` | Make mode-aware (read localStorage, pick endpoint), remove sessionStorage cache |
| `frontend/src/routes/random/+page.svelte` | Add toggle, `skip()`, mode-aware `loadNext()`, conditional buttons, conditional empty state, CSS |

---

## Task 1: `get_random_favorite_post` in `api/db.py`

**Files:**
- Modify: `api/db.py` (add function after `get_random_neutral_post`, around line 393)
- Test: `tests/test_db.py` (append to end of file)

- [ ] **Step 1: Write failing tests**

Append to `tests/test_db.py`:

```python
def test_get_random_favorite_post_returns_none_when_no_favorites(tmp_path):
    from api.db import get_random_favorite_post
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/img.jpg", "jpg",
                  shortcode="POST001", post_timestamp="2026-01-01T10:00:00Z")
    assert get_random_favorite_post(db) is None


def test_get_random_favorite_post_returns_favorited_post(tmp_path):
    from api.db import get_random_favorite_post, upsert_rating
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/img.jpg", "jpg",
                  shortcode="POST001", post_timestamp="2026-01-01T10:00:00Z")
    upsert_rating("POST001", "favorite", db)
    post = get_random_favorite_post(db)
    assert post is not None
    assert post["shortcode"] == "POST001"
    assert post["media"] == [("111/img.jpg", "jpg")]


def test_get_random_favorite_post_excludes_unrated_and_archived(tmp_path):
    from api.db import get_random_favorite_post, upsert_rating
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/unrated.jpg", "jpg",
                  shortcode="UNRATED", post_timestamp="2026-01-01T10:00:00Z")
    _insert_media(db, acc, "111/archived.jpg", "jpg",
                  shortcode="ARCHIVED", post_timestamp="2026-01-02T10:00:00Z")
    _insert_media(db, acc, "111/fav.jpg", "jpg",
                  shortcode="FAVED", post_timestamp="2026-01-03T10:00:00Z")
    upsert_rating("ARCHIVED", "archive", db)
    upsert_rating("FAVED", "favorite", db)
    post = get_random_favorite_post(db)
    assert post is not None
    assert post["shortcode"] == "FAVED"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/test_db.py::test_get_random_favorite_post_returns_none_when_no_favorites tests/test_db.py::test_get_random_favorite_post_returns_favorited_post tests/test_db.py::test_get_random_favorite_post_excludes_unrated_and_archived -v
```

Expected: 3 failures with `ImportError` or `AttributeError` — `get_random_favorite_post` not defined yet.

- [ ] **Step 3: Implement `get_random_favorite_post` in `api/db.py`**

Add this function immediately after `get_random_neutral_post` (after line 392):

```python
def get_random_favorite_post(db_path: Path) -> dict | None:
    conn = _conn(db_path, read_only=True)
    try:
        account_row = conn.execute("""
            SELECT a.id
            FROM media m
            JOIN ratings r ON r.shortcode = m.shortcode
            JOIN accounts a ON a.id = m.account_id
            WHERE r.favorited_at IS NOT NULL
              AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
            GROUP BY a.id
            ORDER BY RANDOM()
            LIMIT 1
        """).fetchone()
        if not account_row:
            return None
        row = conn.execute("""
            SELECT DISTINCT m.shortcode FROM media m
            JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.shortcode IS NOT NULL
              AND r.favorited_at IS NOT NULL
              AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
              AND m.account_id = ?
            ORDER BY RANDOM() LIMIT 1
        """, (account_row["id"],)).fetchone()
        if not row:
            return None
        rows = conn.execute("""
            SELECT m.filepath, m.extension, m.post_timestamp, m.caption, m.shortcode,
                   a.username AS account, a.active AS account_active
            FROM media m
            JOIN accounts a ON a.id = m.account_id
            JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.shortcode = ? AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
              AND r.favorited_at IS NOT NULL
            ORDER BY m.carousel_index ASC
        """, (row["shortcode"],)).fetchall()
    finally:
        conn.close()

    if not rows:
        return None
    first = rows[0]
    return {
        "account": first["account"],
        "account_active": bool(first["account_active"]),
        "post_timestamp": first["post_timestamp"],
        "caption": first["caption"],
        "shortcode": first["shortcode"],
        "media": [(r["filepath"], r["extension"] or "jpg") for r in rows],
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
.venv/bin/pytest tests/test_db.py -v
```

Expected: all 21 tests pass (18 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add api/db.py tests/test_db.py
git commit -m "feat: add get_random_favorite_post db function"
```

---

## Task 2: `GET /api/random/favorites` route

**Files:**
- Modify: `api/routes/random.py`
- Create: `tests/test_random_route.py`

- [ ] **Step 1: Create `tests/test_random_route.py` with failing tests**

```python
import sqlite3
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.db import init_db, upsert_rating
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
        (account_id, filepath.split("/")[-1], filepath, extension, shortcode, post_timestamp),
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/test_random_route.py -v
```

Expected: 3 failures — `404 Not Found` for `/api/random/favorites` (route not registered yet).

- [ ] **Step 3: Add route to `api/routes/random.py`**

Current file imports only `get_random_neutral_post`. Update as follows:

```python
import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_random_favorite_post, get_random_neutral_post
from .feed import _encode, _media_type

router = APIRouter()


@router.get("/random")
async def get_random():
    post = await asyncio.to_thread(get_random_neutral_post, DB_PATH)
    if not post:
        return JSONResponse({"post": None})
    return JSONResponse({
        "post": {
            "account": post["account"],
            "post_timestamp": post["post_timestamp"],
            "shortcode": post["shortcode"],
            "media": [
                {"url": f"/api/media/{_encode(fp)}", "type": _media_type(ext)}
                for fp, ext in post["media"]
            ],
        }
    })


@router.get("/random/favorites")
async def get_random_favorites():
    post = await asyncio.to_thread(get_random_favorite_post, DB_PATH)
    if not post:
        return JSONResponse({"post": None})
    return JSONResponse({
        "post": {
            "account": post["account"],
            "post_timestamp": post["post_timestamp"],
            "shortcode": post["shortcode"],
            "media": [
                {"url": f"/api/media/{_encode(fp)}", "type": _media_type(ext)}
                for fp, ext in post["media"]
            ],
        }
    })
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
.venv/bin/pytest tests/test_random_route.py tests/test_db.py -v
```

Expected: all 24 tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/routes/random.py tests/test_random_route.py
git commit -m "feat: add GET /api/random/favorites endpoint"
```

---

## Task 3: Frontend — mode toggle and mode-aware fetch

**Files:**
- Modify: `frontend/src/routes/random/+page.js`
- Modify: `frontend/src/routes/random/+page.svelte`

No automated tests for Svelte components — verify manually (step 7).

- [ ] **Step 1: Update `frontend/src/routes/random/+page.js`**

Replace the entire file with:

```js
const MODE_KEY = 'random-mode';

export async function load({ fetch }) {
  const mode = (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)) || 'all';
  const endpoint = mode === 'favorites' ? '/api/random/favorites' : '/api/random';

  try {
    const res = await fetch(endpoint);
    if (!res.ok) return { post: null, loadError: true };
    const { post } = await res.json();
    return { post: post ?? null };
  } catch {
    return { post: null, loadError: true };
  }
}
```

- [ ] **Step 2: Update the `<script>` section of `+page.svelte`**

Replace the existing `<script>` block (lines 1–103) with:

```js
<script>
  import 'swiper/css';
  import 'swiper/css/pagination';
  import Avatar from '$lib/Avatar.svelte';
  import { formatDate } from '$lib/media.js';

  const MODE_KEY = 'random-mode';

  let { data } = $props();

  let post = $state(data.post);
  let loading = $state(false);
  let visible = $state(true);
  let muted = $state(true);
  let swiperEl = $state(null);
  let fetchError = $state(data.loadError ?? false);
  let mode = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)) || 'all'
  );

  const isCarousel = $derived(post?.media?.length > 1);

  $effect(() => {
    if (!swiperEl) return;

    let destroyed = false;
    let instance = null;

    (async () => {
      try {
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
      } catch {
        // carousel falls back to static image display
      }
    })();

    return () => {
      destroyed = true;
      instance?.destroy();
    };
  });

  function togglePlayPause(e) {
    const video = e.currentTarget;
    video.paused ? video.play().catch(() => {}) : video.pause();
  }

  function toggleMute(e) {
    e.stopPropagation();
    muted = !muted;
  }

  function switchMode(newMode) {
    if (newMode === mode) return;
    mode = newMode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODE_KEY, mode);
    }
    post = null;
    loadNext();
  }

  async function rate(action) {
    if (!post || loading) return;
    loading = true;
    visible = false;
    fetchError = false;

    const shortcode = post.shortcode;

    try {
      await Promise.all([
        new Promise(r => setTimeout(r, 200)),
        fetch('/api/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shortcode, action }),
        }),
      ]);
    } catch {
      // rating request failed — continue to next post anyway
    }

    await loadNext();
  }

  async function skip() {
    if (!post || loading) return;
    loading = true;
    visible = false;
    fetchError = false;
    await loadNext();
  }

  async function loadNext() {
    try {
      const endpoint = mode === 'favorites' ? '/api/random/favorites' : '/api/random';
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error();
      const { post: next } = await res.json();
      post = next;
      muted = true;
    } catch {
      post = null;
      fetchError = true;
    }
    visible = true;
    loading = false;
  }

  async function retryFetch() {
    fetchError = false;
    loading = true;
    await loadNext();
  }
</script>
```

- [ ] **Step 3: Add the mode toggle above the post card in the template**

In the `{#if post}` branch, replace the opening `<div class="page">` block with:

```html
{#if post}
  <div class="page">
    <div class="mode-toggle">
      <button class="mode-btn" class:active={mode === 'all'} onclick={() => switchMode('all')}>All</button>
      <button class="mode-btn" class:active={mode === 'favorites'} onclick={() => switchMode('favorites')}>Favorites</button>
    </div>

    <article class="card" class:fade={!visible}>
```

- [ ] **Step 4: Replace the actions block with conditional buttons**

Replace the existing `<div class="actions">` block:

```html
    <div class="actions">
      {#if mode === 'favorites'}
        <button class="btn forget" disabled={loading} onclick={() => rate('archive')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Forget
        </button>
        <button class="btn next" disabled={loading} onclick={skip}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          Next
        </button>
      {:else}
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
      {/if}
    </div>
  </div>
```

- [ ] **Step 5: Add the favorites-mode empty state**

Replace the final `{:else}` branch (the "All caught up!" state) with:

```html
{:else if mode === 'favorites'}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <p class="empty-title">No favorites yet</p>
    <p class="empty-sub">Posts you remember will appear here.</p>
    <button class="retry-btn" onclick={() => switchMode('all')}>Browse all posts</button>
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
    <p class="empty-sub">Come back later for new posts.</p>
  </div>
{/if}
```

- [ ] **Step 6: Add CSS for the toggle and Next button**

In the `<style>` block, add after the `.page` block rules:

```css
  .mode-toggle {
    display: flex;
    background: var(--color-border-subtle);
    border-radius: 8px;
    padding: 3px;
    align-self: center;
  }

  .mode-btn {
    flex: 1;
    padding: 6px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    background: transparent;
    color: var(--color-text-muted);
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .mode-btn.active {
    background: var(--color-bg);
    color: var(--color-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  .next { background: var(--color-tab-inactive); }
```

- [ ] **Step 7: Start dev server and test manually**

```bash
# Terminal 1
python -m api

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173/random` and verify:

1. Toggle shows "All" active by default.
2. Switching to "Favorites" immediately loads a favorited post (or shows the empty state if none exist).
3. In "All" mode: Forget and Remember buttons appear.
4. In "Favorites" mode: Forget and Next buttons appear.
5. Forget in Favorites mode archives the post and loads the next favorite.
6. Next in Favorites mode skips to the next favorite without rating.
7. Refreshing the page restores the last-used mode.
8. Empty state in Favorites shows heart icon, "No favorites yet" copy, and a "Browse all posts" button that switches back to All.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/routes/random/+page.js frontend/src/routes/random/+page.svelte
git commit -m "feat: add All/Favorites mode toggle to random page"
```
