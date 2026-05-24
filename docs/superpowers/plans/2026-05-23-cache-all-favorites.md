# Cache All Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings button that fetches all favorited media URLs and pre-warms the service worker cache, with a live progress bar.

**Architecture:** A new DB function returns all favorited media filepaths; a new API endpoint encodes them into `/api/media/` URLs; the settings page fetches that list and re-fetches each URL (3 concurrent), letting Workbox's existing CacheFirst route cache them automatically.

**Tech Stack:** Python/FastAPI, SQLite, SvelteKit (Svelte 5 runes), Workbox service worker

---

## File Map

| File | Change |
|---|---|
| `api/db.py` | Add `get_all_favorite_media_filepaths` |
| `api/routes/random.py` | Add `GET /api/favorites/media-urls` endpoint |
| `tests/test_random_route.py` | Add tests for new endpoint |
| `frontend/src/routes/settings/+page.svelte` | Add "Offline favorites" section |

---

### Task 1: Add DB function `get_all_favorite_media_filepaths`

**Files:**
- Modify: `api/db.py`
- Test: `tests/test_random_route.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_random_route.py`:

```python
from api.db import init_db, upsert_rating, get_all_favorite_media_filepaths


def test_get_all_favorite_media_filepaths_returns_favorited_only(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    acc = _insert_account(db, "alice", "111")
    _insert_media(db, acc, "111/img1.jpg", "jpg", "SC001", "2026-01-01T10:00:00Z")
    _insert_media(db, acc, "111/img2.jpg", "jpg", "SC002", "2026-01-02T10:00:00Z")
    _insert_media(db, acc, "111/img3.jpg", "jpg", "SC003", "2026-01-03T10:00:00Z")
    upsert_rating("SC001", "favorite", db)
    upsert_rating("SC002", "archive", db)
    # SC003 unrated

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
make test -- -k "test_get_all_favorite_media_filepaths" -v
```
Expected: 3 FAILs with `ImportError: cannot import name 'get_all_favorite_media_filepaths'`

- [ ] **Step 3: Implement the function in `api/db.py`**

Add after `get_random_favorite_post` (around line 538):

```python
def get_all_favorite_media_filepaths(db_path: Path) -> list[str]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute("""
            SELECT m.filepath
            FROM media m
            JOIN ratings r ON r.shortcode = m.shortcode
            WHERE r.favorited_at IS NOT NULL
              AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
            ORDER BY m.id ASC
        """).fetchall()
        return [r["filepath"] for r in rows]
    finally:
        conn.close()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
make test -- -k "test_get_all_favorite_media_filepaths" -v
```
Expected: 3 PASSes

- [ ] **Step 5: Commit**

```bash
git add api/db.py tests/test_random_route.py
git commit -m "feat: add get_all_favorite_media_filepaths db function"
```

---

### Task 2: Add API endpoint `GET /api/favorites/media-urls`

**Files:**
- Modify: `api/routes/random.py`
- Test: `tests/test_random_route.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_random_route.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
make test -- -k "test_favorites_media_urls" -v
```
Expected: 2 FAILs with 404 (route not registered yet)

- [ ] **Step 3: Add the endpoint in `api/routes/random.py`**

Add after the existing `get_random_favorites` function:

```python
@router.get("/favorites/media-urls")
async def get_favorites_media_urls():
    from ..db import get_all_favorite_media_filepaths
    filepaths = await asyncio.to_thread(get_all_favorite_media_filepaths, DB_PATH)
    urls = [f"/api/media/{_encode(fp)}" for fp in filepaths]
    return JSONResponse({"urls": urls, "total": len(urls)})
```

Also add the import at the top of the file alongside `get_random_neutral_post, get_random_favorite_post`:

```python
from ..db import get_random_neutral_post, get_random_favorite_post, get_all_favorite_media_filepaths
```

And remove the inline import from the function body (use the top-level import instead):

```python
@router.get("/favorites/media-urls")
async def get_favorites_media_urls():
    filepaths = await asyncio.to_thread(get_all_favorite_media_filepaths, DB_PATH)
    urls = [f"/api/media/{_encode(fp)}" for fp in filepaths]
    return JSONResponse({"urls": urls, "total": len(urls)})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
make test -- -k "test_favorites_media_urls" -v
```
Expected: 2 PASSes

- [ ] **Step 5: Run full test suite**

```bash
make test
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add api/routes/random.py tests/test_random_route.py
git commit -m "feat: add GET /api/favorites/media-urls endpoint"
```

---

### Task 3: Add "Offline favorites" section in settings

**Files:**
- Modify: `frontend/src/routes/settings/+page.svelte`

- [ ] **Step 1: Add state variables**

In the `<script>` block of `frontend/src/routes/settings/+page.svelte`, after the existing `let updateLoading` lines (around line 46), add:

```javascript
  let caching = $state(false);
  let cacheTotal = $state(null);
  let cacheDone = $state(0);
  let cacheDoneMsg = $state(null);
  let cacheError = $state(null);
```

- [ ] **Step 2: Add the `cacheAllFavorites` function**

In the `<script>` block, after the `checkForUpdates` function (after line 64), add:

```javascript
  async function cacheAllFavorites() {
    caching = true;
    cacheTotal = null;
    cacheDone = 0;
    cacheDoneMsg = null;
    cacheError = null;

    let urls;
    try {
      const res = await fetch('/api/favorites/media-urls');
      if (!res.ok) throw new Error();
      const json = await res.json();
      urls = json.urls;
      cacheTotal = json.total;
    } catch {
      cacheError = 'Could not load favorites list.';
      caching = false;
      return;
    }

    if (urls.length === 0) {
      cacheDoneMsg = 'No favorites to cache.';
      caching = false;
      return;
    }

    const BATCH = 3;
    for (let i = 0; i < urls.length; i += BATCH) {
      const batch = urls.slice(i, i + BATCH);
      await Promise.allSettled(batch.map((url) => fetch(url)));
      cacheDone = Math.min(i + BATCH, urls.length);
    }

    cacheDoneMsg = `Done — ${urls.length} file${urls.length === 1 ? '' : 's'} cached.`;
    caching = false;
  }
```

- [ ] **Step 3: Add the HTML section**

In the template, add a new section between the "App" section and the "Logs" section (after the `</div>` closing the `app-section`, before the next `<div class="divider">`):

```html
  <div class="divider"></div>

  <div class="offline-section">
    <span class="field-label">Offline favorites</span>
    <span class="label">Download all favorites for offline use</span>
    {#if cacheError}
      <p class="error">{cacheError}</p>
    {/if}
    {#if cacheDoneMsg}
      <p class="saved">{cacheDoneMsg}</p>
    {/if}
    {#if caching || cacheDoneMsg}
      <progress
        class="cache-progress"
        value={cacheDone}
        max={cacheTotal ?? 1}
      ></progress>
    {/if}
    <button class="btn" type="button" disabled={caching} onclick={cacheAllFavorites}>
      {caching
        ? cacheTotal !== null
          ? `Caching… ${cacheDone} / ${cacheTotal}`
          : 'Loading…'
        : 'Cache all'}
    </button>
  </div>
```

- [ ] **Step 4: Add the CSS for the progress bar**

In the `<style>` block, add after the `.stats-section, .scheduler-section` rule:

```css
  .offline-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cache-progress {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    appearance: none;
    border: none;
    background: var(--color-border);
    overflow: hidden;
  }

  .cache-progress::-webkit-progress-bar {
    background: var(--color-border);
    border-radius: 2px;
  }

  .cache-progress::-webkit-progress-value {
    background: var(--color-text);
    border-radius: 2px;
    transition: width 0.2s ease;
  }

  .cache-progress::-moz-progress-bar {
    background: var(--color-text);
    border-radius: 2px;
  }
```

- [ ] **Step 5: Also add `offline-section` to the compound CSS selector for shared layout**

Find this rule in the `<style>` block:

```css
  .stats-section,
  .scheduler-section,
  .sync-saved-section,
  .app-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
```

Remove `.offline-section` from needing a duplicate rule by ensuring it's handled by the dedicated `.offline-section` rule added in step 4 (it already has `display: flex; flex-direction: column; gap: 8px` — no further change needed).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/settings/+page.svelte
git commit -m "feat: add offline favorites cache button with progress bar in settings"
```

---

## Self-Review

**Spec coverage:**
- ✅ New DB function returning favorited media filepaths
- ✅ New API endpoint `GET /api/favorites/media-urls`
- ✅ Settings section with button + progress bar
- ✅ Batch fetch (3 concurrent) with `Promise.allSettled`
- ✅ Completion message
- ✅ Error handling for failed fetch of URL list
- ✅ Workbox handles eviction — no changes to `sw.js`

**Placeholder scan:** None found.

**Type consistency:**
- `get_all_favorite_media_filepaths` used consistently in DB, route, and tests
- `cacheTotal`, `cacheDone`, `cacheDoneMsg`, `cacheError` used consistently across script and template
