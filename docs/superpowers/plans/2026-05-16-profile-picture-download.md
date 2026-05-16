# Profile Picture Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download the Instagram profile picture for each account when first added via sync-following, store it on disk, and display it on the Following page with a letter-circle fallback.

**Architecture:** Three new DB functions handle the column migration and profile-pic storage. The sync-following route fires a non-blocking async background task that downloads each pic via the existing authenticated session (1–2 s delay between requests). A new `GET /api/accounts/{username}/avatar` route serves the stored file. The Following page stacks an `<img>` over the existing letter-circle div; the letter circle shows when the image errors.

**Tech Stack:** FastAPI, SQLite (via `api/db.py`), Instaloader `requests.Session` for CDN downloads, SvelteKit (Svelte 5)

---

## File Map

| File | Change |
|---|---|
| `api/db.py` | Add `profile_pic_path` column to schema + migration guard; add 3 new functions |
| `api/routes/accounts.py` | Update imports; add background download coroutine; update sync-following; add avatar route |
| `tests/test_account_db.py` | Add 6 tests for new DB functions |
| `tests/test_account_route.py` | Add 3 tests for avatar route |
| `frontend/src/routes/following/+page.svelte` | Replace letter-circle with `<img>` + letter-circle fallback |

---

### Task 1: DB layer — `profile_pic_path` column and helper functions

**Files:**
- Modify: `api/db.py`
- Test: `tests/test_account_db.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_account_db.py` (keep existing tests untouched, add new imports at top):

```python
# Add to the existing import line at the top of the file:
from api.db import (
    init_db, get_setting, set_setting, delete_setting,
    upsert_following_accounts,
    save_account_profile_pic,
    get_account_profile_pic_path,
    get_accounts_missing_profile_pic,
)


def test_profile_pic_path_column_exists_after_init(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    import sqlite3
    conn = sqlite3.connect(str(db))
    cols = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
    conn.close()
    assert "profile_pic_path" in cols


def test_save_and_get_account_profile_pic(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "instagram_user_id": "123"}], db)
    save_account_profile_pic("123", "123/profile.jpg", db)
    assert get_account_profile_pic_path("alice", db) == "123/profile.jpg"


def test_get_account_profile_pic_path_returns_none_for_unknown_user(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_account_profile_pic_path("nobody", db) is None


def test_get_account_profile_pic_path_returns_none_when_not_downloaded(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "instagram_user_id": "123"}], db)
    assert get_account_profile_pic_path("alice", db) is None


def test_get_accounts_missing_profile_pic_returns_only_those_without_pic(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([
        {"username": "alice", "instagram_user_id": "111"},
        {"username": "bob",   "instagram_user_id": "222"},
    ], db)
    save_account_profile_pic("111", "111/profile.jpg", db)
    missing = get_accounts_missing_profile_pic(["111", "222"], db)
    assert missing == {"222"}


def test_get_accounts_missing_profile_pic_returns_empty_set_for_empty_input(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_accounts_missing_profile_pic([], db) == set()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/clement/Developer/amstramgram
python -m pytest tests/test_account_db.py::test_profile_pic_path_column_exists_after_init tests/test_account_db.py::test_save_and_get_account_profile_pic -v
```

Expected: `ImportError` (functions not defined yet).

- [ ] **Step 3: Add `profile_pic_path` column to `init_db` schema and migration guard**

Replace the entire `init_db` function in `api/db.py` with:

```python
def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = _conn(db_path)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS accounts (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                instagram_user_id TEXT    UNIQUE,
                username          TEXT    NOT NULL UNIQUE,
                active            INTEGER NOT NULL DEFAULT 0,
                fully_synced      INTEGER NOT NULL DEFAULT 0,
                profile_pic_path  TEXT,
                added_at          TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS media (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id      INTEGER NOT NULL REFERENCES accounts(id),
                filename        TEXT NOT NULL,
                filepath        TEXT NOT NULL UNIQUE,
                extension       TEXT,
                post_timestamp  TEXT,
                downloaded_at   TEXT NOT NULL DEFAULT (datetime('now')),
                file_size       INTEGER,
                width           INTEGER,
                height          INTEGER,
                shortcode       TEXT,
                post_type       TEXT,
                carousel_index  INTEGER,
                caption         TEXT,
                like_count      INTEGER,
                comment_count   INTEGER,
                location        TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_media_account_shortcode
                ON media (account_id, shortcode);
            CREATE TABLE IF NOT EXISTS ratings (
                shortcode    TEXT PRIMARY KEY,
                archived_at  TEXT,
                favorited_at TEXT
            );
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
        """)
        cols = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
        if "profile_pic_path" not in cols:
            conn.execute("ALTER TABLE accounts ADD COLUMN profile_pic_path TEXT")
            conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 4: Add three new functions to `api/db.py`**

Add the following three functions immediately after `upsert_following_accounts`:

```python
def save_account_profile_pic(instagram_user_id: str, path: str, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute(
            "UPDATE accounts SET profile_pic_path = ? WHERE instagram_user_id = ?",
            (path, instagram_user_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_account_profile_pic_path(username: str, db_path: Path) -> str | None:
    conn = _conn(db_path, read_only=True)
    try:
        row = conn.execute(
            "SELECT profile_pic_path FROM accounts WHERE username = ?",
            (username,),
        ).fetchone()
        return row["profile_pic_path"] if row else None
    finally:
        conn.close()


def get_accounts_missing_profile_pic(instagram_user_ids: list[str], db_path: Path) -> set[str]:
    if not instagram_user_ids:
        return set()
    conn = _conn(db_path, read_only=True)
    try:
        placeholders = ",".join("?" * len(instagram_user_ids))
        rows = conn.execute(
            f"SELECT instagram_user_id FROM accounts"
            f" WHERE instagram_user_id IN ({placeholders}) AND profile_pic_path IS NULL",
            instagram_user_ids,
        ).fetchall()
        return {row["instagram_user_id"] for row in rows}
    finally:
        conn.close()
```

- [ ] **Step 5: Run all DB tests**

```bash
python -m pytest tests/test_account_db.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add api/db.py tests/test_account_db.py
git commit -m "feat: add profile_pic_path column and DB helper functions"
```

---

### Task 2: Background profile picture download

**Files:**
- Modify: `api/routes/accounts.py`

- [ ] **Step 1: Replace the import block at the top of `api/routes/accounts.py`**

Replace:

```python
import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_all_accounts, upsert_following_accounts
from ..loader import get_loader
```

with:

```python
import asyncio
import logging
import random
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from ..config import DB_PATH, STORAGE_BASE
from ..db import (
    get_account_profile_pic_path,
    get_accounts_missing_profile_pic,
    get_all_accounts,
    save_account_profile_pic,
    upsert_following_accounts,
)
from ..loader import get_loader
```

- [ ] **Step 2: Add the background download coroutine**

Add the following function immediately after the `logger = logging.getLogger(__name__)` line and before `router = APIRouter()`:

```python
async def _download_profile_pics_bg(candidates: list[dict], L) -> None:
    for account in candidates:
        username = account["username"]
        instagram_user_id = account["instagram_user_id"]
        profile_pic_url = account.get("profile_pic_url", "")
        if not profile_pic_url:
            continue
        logger.info("profile_pic: downloading for %s", username)
        try:
            resp = L.context._session.get(profile_pic_url, timeout=15)
            resp.raise_for_status()
            dest = STORAGE_BASE / instagram_user_id
            dest.mkdir(parents=True, exist_ok=True)
            (dest / "profile.jpg").write_bytes(resp.content)
            save_account_profile_pic(instagram_user_id, f"{instagram_user_id}/profile.jpg", DB_PATH)
            logger.info("profile_pic: saved for %s", username)
        except Exception as exc:
            logger.error("profile_pic: failed for %s — %s", username, exc)
        await asyncio.sleep(random.uniform(1, 2))
```

- [ ] **Step 3: Update `_fetch_and_upsert_following` to return candidates**

Replace the existing `_fetch_and_upsert_following` function with:

```python
def _fetch_and_upsert_following(L, db_path: Path) -> tuple[int, list[dict]]:
    logger.info("sync-following: fetching following list")
    user_info = L.context.get_iphone_json("api/v1/accounts/current_user/", {"edit": "false"})
    user_id = user_info["user"]["pk"]

    accounts = []
    params: dict = {"count": 200}
    while True:
        data = L.context.get_iphone_json(f"api/v1/friendships/{user_id}/following/", params)
        for user in data.get("users", []):
            accounts.append({
                "username": user["username"],
                "instagram_user_id": str(user["pk"]),
                "profile_pic_url": user.get("profile_pic_url", ""),
            })
        next_cursor = data.get("next_max_id")
        if not next_cursor:
            break
        params = {"count": 200, "max_id": next_cursor}

    logger.info("sync-following: %d account(s) found in following list", len(accounts))
    added = upsert_following_accounts(accounts, db_path)
    logger.info("sync-following: %d new account(s) added", added)

    missing_ids = get_accounts_missing_profile_pic(
        [a["instagram_user_id"] for a in accounts], db_path
    )
    candidates = [a for a in accounts if a["instagram_user_id"] in missing_ids]
    return added, candidates
```

- [ ] **Step 4: Update `sync_following_route` to unpack the tuple and fire the background task**

Replace the existing `sync_following_route` with:

```python
@router.post("/accounts/sync-following")
async def sync_following_route():
    L = get_loader()
    if L is None:
        return JSONResponse({"detail": "No session configured"}, status_code=400)
    try:
        added, candidates = await asyncio.to_thread(_fetch_and_upsert_following, L, DB_PATH)
    except Exception as exc:
        logger.exception("sync-following failed: %s", exc)
        return JSONResponse({"detail": "Sync failed. Please try again."}, status_code=500)
    if candidates:
        asyncio.create_task(_download_profile_pics_bg(candidates, L))
    return JSONResponse({"added": added})
```

- [ ] **Step 5: Verify the server starts cleanly**

```bash
python -m api
```

Expected: server starts with no import errors. Stop with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add api/routes/accounts.py
git commit -m "feat: download profile pictures as background task after sync-following"
```

---

### Task 3: Avatar API route

**Files:**
- Modify: `api/routes/accounts.py`
- Test: `tests/test_account_route.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/test_account_route.py`. First, update the existing `api.db` import line at the top of the file to add `upsert_following_accounts` and `save_account_profile_pic`:

```python
# Replace this line:
from api.db import init_db, set_setting
# With:
from api.db import init_db, set_setting, upsert_following_accounts, save_account_profile_pic
```

Then append these three test functions at the end of the file:

```python
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
    upsert_following_accounts([{"username": "alice", "instagram_user_id": "123"}], db)
    resp = tc.get("/api/accounts/alice/avatar")
    assert resp.status_code == 404


def test_avatar_returns_jpeg_when_pic_exists(avatar_client):
    tc, db, storage = avatar_client
    upsert_following_accounts([{"username": "alice", "instagram_user_id": "123"}], db)
    pic_dir = storage / "123"
    pic_dir.mkdir()
    (pic_dir / "profile.jpg").write_bytes(b"\xff\xd8\xff\xe0")  # minimal JPEG header
    save_account_profile_pic("123", "123/profile.jpg", db)
    resp = tc.get("/api/accounts/alice/avatar")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/jpeg")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_account_route.py::test_avatar_returns_404_when_account_unknown -v
```

Expected: FAILED (route not defined yet).

- [ ] **Step 3: Add the avatar route to `api/routes/accounts.py`**

Add after the closing of `sync_following_route`:

```python
@router.get("/accounts/{username}/avatar")
async def get_account_avatar_route(username: str):
    profile_pic_path = await asyncio.to_thread(get_account_profile_pic_path, username, DB_PATH)
    if not profile_pic_path:
        raise HTTPException(status_code=404, detail="Avatar not found")
    full_path = STORAGE_BASE / profile_pic_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(str(full_path), media_type="image/jpeg")
```

- [ ] **Step 4: Run all route tests**

```bash
python -m pytest tests/test_account_route.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/routes/accounts.py tests/test_account_route.py
git commit -m "feat: add GET /api/accounts/{username}/avatar route"
```

---

### Task 4: Following page — profile picture with letter-circle fallback

**Files:**
- Modify: `frontend/src/routes/following/+page.svelte`

The strategy: stack the `<img>` absolutely on top of the letter-circle div. The letter circle is always rendered (no JS state). When the image loads successfully it covers the circle. When the image errors, `onerror` hides the img and the circle shows through.

- [ ] **Step 1: Wrap the avatar div and add the `<img>` element**

In the `{#each data.accounts as account}` block, replace:

```svelte
          <div class="avatar" style="background:{avatarColor(account.username)}">
            {account.username[0].toUpperCase()}
          </div>
```

with:

```svelte
          <div class="avatar-wrap">
            <img
              class="avatar-img"
              src="/api/accounts/{account.username}/avatar"
              alt={account.username}
              onerror="this.style.display='none'"
            />
            <div class="avatar" style="background:{avatarColor(account.username)}">
              {account.username[0].toUpperCase()}
            </div>
          </div>
```

- [ ] **Step 2: Update the `<style>` block**

Replace the existing `.avatar` rule:

```css
  .avatar {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0;
  }
```

with:

```css
  .avatar-wrap {
    flex-shrink: 0;
    position: relative;
    width: 44px;
    height: 44px;
  }

  .avatar-img {
    position: absolute;
    inset: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    z-index: 1;
  }

  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0;
  }
```

- [ ] **Step 3: Start the dev server and verify visually**

In two terminals:

```bash
# Terminal 1
python -m api

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173/following`. Check:
- Accounts with a downloaded profile pic (`profile_pic_path` not null) show the real circular photo.
- Accounts without a pic show the colored letter circle (img 404 → hidden, fallback shows).
- Layout is unchanged: 44 × 44 px circle, spacing matches other rows.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/following/+page.svelte
git commit -m "feat: show profile pictures on following page with letter-circle fallback"
```
