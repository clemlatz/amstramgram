# Account Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add individual account pages at `/accounts/[username]` with an Instagram-style header (avatar, stats, bio) and a 3-column post grid; update all account name links to use this internal route.

**Architecture:** Backend adds `bio`/`full_name`/`external_url` columns to `accounts`, two new DB functions, and two new API endpoints. Frontend adds a new SvelteKit route and minor updates to `Avatar.svelte`, `PostCard.svelte`, `following/+page.svelte`, and `+layout.svelte`.

**Tech Stack:** FastAPI, SQLite, SvelteKit (Svelte 5 with runes), pytest

---

## File map

| File | Change |
|---|---|
| `api/db.py` | Add migration + `get_account_detail` + `get_account_posts` + update `upsert_following_accounts` |
| `api/routes/accounts.py` | Add 2 endpoints + update `_fetch_and_upsert_following` |
| `tests/test_account_db.py` | Add tests for new DB functions + schema + bio fields |
| `tests/test_account_route.py` | Add tests for new endpoints |
| `tests/test_sync_following.py` | Add bio storage tests |
| `frontend/src/lib/Avatar.svelte` | Add `size` prop |
| `frontend/src/routes/accounts/[username]/+page.js` | New: load profile + posts |
| `frontend/src/routes/accounts/[username]/+page.svelte` | New: account page |
| `frontend/src/lib/PostCard.svelte` | Update account link to internal route |
| `frontend/src/routes/following/+page.svelte` | Update username link to internal route |
| `frontend/src/routes/+layout.svelte` | Highlight Following tab on `/accounts/*` |

---

## Task 1: DB schema — add bio/full_name/external_url columns

**Files:**
- Modify: `api/db.py:80-82`
- Test: `tests/test_account_db.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_account_db.py`:

```python
def test_bio_columns_exist_after_init(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    import sqlite3
    conn = sqlite3.connect(str(db))
    cols = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
    conn.close()
    assert "bio" in cols
    assert "full_name" in cols
    assert "external_url" in cols
```

- [ ] **Step 2: Run test to verify it fails**

```bash
make test
```
Expected: FAIL — `AssertionError: assert 'bio' in ...`

- [ ] **Step 3: Add migration in `init_db`**

In `api/db.py`, replace lines 80-82:

```python
        if "profile_pic_path" not in cols:
            conn.execute("ALTER TABLE accounts ADD COLUMN profile_pic_path TEXT")
            conn.commit()
```

With:

```python
        if "profile_pic_path" not in cols:
            conn.execute("ALTER TABLE accounts ADD COLUMN profile_pic_path TEXT")
            conn.commit()
        for col in ("bio", "full_name", "external_url"):
            if col not in cols:
                conn.execute(f"ALTER TABLE accounts ADD COLUMN {col} TEXT")
        conn.commit()
```

- [ ] **Step 4: Run tests**

```bash
make test
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add api/db.py tests/test_account_db.py
git commit -m "feat: add bio/full_name/external_url columns to accounts"
```

---

## Task 2: DB function `get_account_detail`

**Files:**
- Modify: `api/db.py` (add function after `get_all_accounts`, line ~535)
- Test: `tests/test_account_db.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_account_db.py` (add import at top: `from api.db import ... get_account_detail`):

```python
from api.db import (
    init_db, get_setting, set_setting, delete_setting,
    upsert_following_accounts,
    save_account_profile_pic,
    get_account_profile_pic_path,
    get_accounts_missing_profile_pic,
    get_all_accounts,
    get_account_detail,
)


def test_get_account_detail_returns_none_for_unknown(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_account_detail("nobody", db) is None


def test_get_account_detail_returns_basic_fields(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    result = get_account_detail("alice", db)
    assert result is not None
    assert result["username"] == "alice"
    assert result["active"] is True
    assert result["post_count"] == 0
    assert result["unrated_count"] == 0
    assert result["favorited_count"] == 0
    assert result["archived_count"] == 0


def test_get_account_detail_counts_posts_and_ratings(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute("SELECT id FROM accounts WHERE username='alice'").fetchone()[0]
    conn.close()
    _insert_media(db, account_id, "sc1")
    _insert_media(db, account_id, "sc2")
    _insert_media(db, account_id, "sc3")
    _insert_rating(db, "sc1", favorited=True)
    _insert_rating(db, "sc2", archived=True)

    result = get_account_detail("alice", db)
    assert result["post_count"] == 3
    assert result["unrated_count"] == 1   # sc3 has no rating
    assert result["favorited_count"] == 1
    assert result["archived_count"] == 1


def test_get_account_detail_returns_bio_fields(tmp_path):
    import sqlite3
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{
        "username": "alice", "platform_user_id": "111",
        "bio": "Hello world", "full_name": "Alice Smith", "external_url": "https://example.com"
    }], db)
    result = get_account_detail("alice", db)
    assert result["bio"] == "Hello world"
    assert result["full_name"] == "Alice Smith"
    assert result["external_url"] == "https://example.com"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
make test
```
Expected: ImportError or NameError — `get_account_detail` not defined

- [ ] **Step 3: Implement `get_account_detail` in `api/db.py`**

Add after the `get_all_accounts` function (after line 535):

```python
def get_account_detail(username: str, db_path: Path) -> dict | None:
    conn = _conn(db_path, read_only=True)
    try:
        row = conn.execute("""
            SELECT
                a.username,
                a.full_name,
                a.bio,
                a.external_url,
                a.active,
                COUNT(DISTINCT m.id) AS post_count,
                COUNT(DISTINCT CASE WHEN m.shortcode IS NOT NULL AND r.shortcode IS NULL
                                    THEN m.shortcode END) AS unrated_count,
                COUNT(DISTINCT CASE WHEN r.favorited_at IS NOT NULL
                                    THEN m.shortcode END) AS favorited_count,
                COUNT(DISTINCT CASE WHEN r.archived_at IS NOT NULL
                                    THEN m.shortcode END) AS archived_count
            FROM accounts a
            LEFT JOIN media m
                ON m.account_id = a.id
                AND m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            WHERE a.username = ?
            GROUP BY a.id
        """, (username,)).fetchone()
        if not row:
            return None
        return {
            "username": row["username"],
            "full_name": row["full_name"],
            "bio": row["bio"],
            "external_url": row["external_url"],
            "active": bool(row["active"]),
            "post_count": row["post_count"],
            "unrated_count": row["unrated_count"],
            "favorited_count": row["favorited_count"],
            "archived_count": row["archived_count"],
        }
    finally:
        conn.close()
```

- [ ] **Step 4: Run tests**

```bash
make test
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add api/db.py tests/test_account_db.py
git commit -m "feat: add get_account_detail DB function"
```

---

## Task 3: DB function `get_account_posts`

**Files:**
- Modify: `api/db.py` (add function after `get_account_detail`)
- Test: `tests/test_account_db.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_account_db.py` (update import to include `get_account_posts`):

```python
from api.db import (
    init_db, get_setting, set_setting, delete_setting,
    upsert_following_accounts,
    save_account_profile_pic,
    get_account_profile_pic_path,
    get_accounts_missing_profile_pic,
    get_all_accounts,
    get_account_detail,
    get_account_posts,
)


def _insert_media_with_timestamp(db: Path, account_id: int, shortcode: str, ts: str, filepath: str) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, post_timestamp)"
        " VALUES (?, ?, ?, 'jpg', ?, ?)",
        (account_id, f"{shortcode}.jpg", filepath, shortcode, ts),
    )
    conn.commit()
    conn.close()


def test_get_account_posts_returns_empty_for_unknown(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_account_posts("nobody", db) == []


def test_get_account_posts_returns_posts_for_account(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute("SELECT id FROM accounts WHERE username='alice'").fetchone()[0]
    conn.close()
    _insert_media_with_timestamp(db, account_id, "sc1", "2024-01-02T00:00:00Z", "111/sc1.jpg")
    _insert_media_with_timestamp(db, account_id, "sc2", "2024-01-01T00:00:00Z", "111/sc2.jpg")
    posts = get_account_posts("alice", db)
    assert len(posts) == 2
    assert posts[0]["shortcode"] == "sc1"  # newer first
    assert posts[1]["shortcode"] == "sc2"


def test_get_account_posts_does_not_include_other_accounts(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([
        {"username": "alice", "platform_user_id": "111"},
        {"username": "bob",   "platform_user_id": "222"},
    ], db)
    conn = sqlite3.connect(str(db))
    alice_id = conn.execute("SELECT id FROM accounts WHERE username='alice'").fetchone()[0]
    bob_id   = conn.execute("SELECT id FROM accounts WHERE username='bob'").fetchone()[0]
    conn.close()
    _insert_media_with_timestamp(db, alice_id, "sc_alice", "2024-01-01T00:00:00Z", "111/a.jpg")
    _insert_media_with_timestamp(db, bob_id,   "sc_bob",   "2024-01-01T00:00:00Z", "222/b.jpg")
    posts = get_account_posts("alice", db)
    assert len(posts) == 1
    assert posts[0]["shortcode"] == "sc_alice"


def test_get_account_posts_groups_carousel_slides(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute("SELECT id FROM accounts WHERE username='alice'").fetchone()[0]
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, post_timestamp, carousel_index)"
        " VALUES (?, 'sc1_1.jpg', '111/sc1_1.jpg', 'jpg', 'sc1', '2024-01-01T00:00:00Z', 1)",
        (account_id,),
    )
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, post_timestamp, carousel_index)"
        " VALUES (?, 'sc1_2.jpg', '111/sc1_2.jpg', 'jpg', 'sc1', '2024-01-01T00:00:00Z', 2)",
        (account_id,),
    )
    conn.commit()
    conn.close()
    posts = get_account_posts("alice", db)
    assert len(posts) == 1
    assert len(posts[0]["media"]) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
make test
```
Expected: ImportError — `get_account_posts` not defined

- [ ] **Step 3: Implement `get_account_posts` in `api/db.py`**

Add after `get_account_detail`:

```python
def get_account_posts(username: str, db_path: Path) -> list[dict]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute("""
            SELECT m.filepath, m.extension, m.post_timestamp, m.caption, m.shortcode,
                   m.width, m.height, r.archived_at, r.favorited_at,
                   a.username AS account, a.active AS account_active
            FROM media m
            JOIN accounts a ON a.id = m.account_id
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            WHERE m.extension IN ('jpg', 'jpeg', 'webp', 'png', 'mp4')
              AND a.username = ?
            ORDER BY m.post_timestamp DESC, m.carousel_index ASC
        """, (username,)).fetchall()
    finally:
        conn.close()

    posts: dict[str, dict] = {}
    for row in rows:
        key = f"{row['account']}/{row['post_timestamp']}" if row["post_timestamp"] else row["filepath"]
        if key not in posts:
            posts[key] = {
                "account": row["account"],
                "account_active": bool(row["account_active"]),
                "post_timestamp": row["post_timestamp"],
                "caption": row["caption"],
                "shortcode": row["shortcode"],
                "archived_at": row["archived_at"],
                "favorited_at": row["favorited_at"],
                "media": [],
            }
        posts[key]["media"].append((row["filepath"], row["extension"] or "jpg", row["width"], row["height"]))

    return list(posts.values())
```

- [ ] **Step 4: Run tests**

```bash
make test
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add api/db.py tests/test_account_db.py
git commit -m "feat: add get_account_posts DB function"
```

---

## Task 4: Store bio fields during `upsert_following_accounts`

**Files:**
- Modify: `api/db.py:538-557` (`upsert_following_accounts`)
- Test: `tests/test_sync_following.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_sync_following.py`:

```python
def test_upsert_stores_bio_fields(db):
    import sqlite3
    upsert_following_accounts([{
        "username": "alice", "platform_user_id": "111",
        "bio": "Hello", "full_name": "Alice Smith", "external_url": "https://example.com",
    }], db)
    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT bio, full_name, external_url FROM accounts WHERE username='alice'").fetchone()
    conn.close()
    assert row[0] == "Hello"
    assert row[1] == "Alice Smith"
    assert row[2] == "https://example.com"


def test_upsert_updates_bio_on_resync(db):
    import sqlite3
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111", "bio": "Old bio"}], db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111", "bio": "New bio"}], db)
    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT bio FROM accounts WHERE username='alice'").fetchone()
    conn.close()
    assert row[0] == "New bio"


def test_upsert_tolerates_missing_bio_fields(db):
    added, _ = upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    assert added == 1  # must not raise
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
make test
```
Expected: FAIL — bio is None after upsert

- [ ] **Step 3: Update `upsert_following_accounts` in `api/db.py`**

Replace the function body (lines 538-557) with:

```python
def upsert_following_accounts(accounts: list[dict], db_path: Path) -> tuple[int, list[str]]:
    if not accounts:
        return 0, []
    conn = _conn(db_path)
    try:
        platform_ids = [a["platform_user_id"] for a in accounts]
        placeholders = ",".join("?" * len(platform_ids))
        existing = {r[0] for r in conn.execute(
            f"SELECT platform_user_id FROM accounts WHERE platform_user_id IN ({placeholders})",
            platform_ids,
        )}
        new_accounts = [a for a in accounts if a["platform_user_id"] not in existing]
        conn.executemany(
            "INSERT OR IGNORE INTO accounts (username, platform_user_id, active) VALUES (?, ?, 1)",
            [(a["username"], a["platform_user_id"]) for a in accounts],
        )
        conn.executemany(
            "UPDATE accounts SET bio = ?, full_name = ?, external_url = ? WHERE platform_user_id = ?",
            [(a.get("bio"), a.get("full_name"), a.get("external_url"), a["platform_user_id"])
             for a in accounts],
        )
        conn.commit()
        return len(new_accounts), [a["username"] for a in new_accounts]
    finally:
        conn.close()
```

- [ ] **Step 4: Run tests**

```bash
make test
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add api/db.py tests/test_sync_following.py
git commit -m "feat: store bio/full_name/external_url in upsert_following_accounts"
```

---

## Task 5: Extract bio from Instagram response during sync

**Files:**
- Modify: `api/routes/accounts.py:119-130` (`_fetch_and_upsert_following`)
- Test: `tests/test_sync_following.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_sync_following.py`:

```python
def test_sync_stores_bio_from_instagram_response(client):
    import sqlite3
    tc, db = client
    page = {"users": [{"username": "alice", "pk": "111", "biography": "My bio", "full_name": "Alice", "external_url": "https://alice.com"}]}
    mock_L = _make_loader([page])
    with patch("api.routes.accounts.get_loader", return_value=mock_L):
        resp = tc.post("/api/accounts/sync-following")
    assert resp.status_code == 200
    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT bio, full_name, external_url FROM accounts WHERE username='alice'").fetchone()
    conn.close()
    assert row[0] == "My bio"
    assert row[1] == "Alice"
    assert row[2] == "https://alice.com"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
make test
```
Expected: FAIL — bio is None

- [ ] **Step 3: Update `_fetch_and_upsert_following` in `api/routes/accounts.py`**

Replace lines 123-128 (the `accounts.append(...)` block inside the for loop):

```python
        for user in data.get("users", []):
            accounts.append({
                "username": user["username"],
                "platform_user_id": str(user["pk"]),
                "profile_pic_url": user.get("profile_pic_url", ""),
                "bio": user.get("biography") or "",
                "full_name": user.get("full_name") or "",
                "external_url": user.get("external_url") or "",
            })
```

- [ ] **Step 4: Run tests**

```bash
make test
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add api/routes/accounts.py tests/test_sync_following.py
git commit -m "feat: extract bio/full_name/external_url from Instagram sync response"
```

---

## Task 6: New API endpoints — account detail and account posts

**Files:**
- Modify: `api/routes/accounts.py` (add 2 route handlers + imports)
- Test: `tests/test_account_route.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_account_route.py`:

```python
import sqlite3 as _sqlite3


@pytest.fixture()
def account_client(tmp_path):
    db = tmp_path / "test.db"
    storage = tmp_path / "storage"
    storage.mkdir()
    init_db(db)
    with (
        patch("api.routes.accounts.DB_PATH", db),
        patch("api.routes.accounts.STORAGE_BASE", storage),
    ):
        yield TestClient(app), db, storage


def _insert_account_media(db, account_id: int, shortcode: str, ts: str, filepath: str) -> None:
    conn = _sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode, post_timestamp)"
        " VALUES (?, ?, ?, 'jpg', ?, ?)",
        (account_id, f"{shortcode}.jpg", filepath, shortcode, ts),
    )
    conn.commit()
    conn.close()


def test_get_account_detail_returns_404_for_unknown(account_client):
    tc, db, _ = account_client
    resp = tc.get("/api/accounts/nobody")
    assert resp.status_code == 404


def test_get_account_detail_returns_profile(account_client):
    tc, db, _ = account_client
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111", "bio": "Hi"}], db)
    resp = tc.get("/api/accounts/alice")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "alice"
    assert data["bio"] == "Hi"
    assert "post_count" in data
    assert "unrated_count" in data
    assert "favorited_count" in data
    assert "archived_count" in data


def test_get_account_posts_returns_empty_for_unknown(account_client):
    tc, db, _ = account_client
    resp = tc.get("/api/accounts/nobody/posts")
    assert resp.status_code == 200
    assert resp.json() == {"posts": []}


def test_get_account_posts_returns_posts(account_client):
    tc, db, _ = account_client
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = _sqlite3.connect(str(db))
    account_id = conn.execute("SELECT id FROM accounts WHERE username='alice'").fetchone()[0]
    conn.close()
    _insert_account_media(db, account_id, "sc1", "2024-01-01T00:00:00Z", "111/sc1.jpg")
    resp = tc.get("/api/accounts/alice/posts")
    assert resp.status_code == 200
    posts = resp.json()["posts"]
    assert len(posts) == 1
    assert posts[0]["shortcode"] == "sc1"
    assert posts[0]["media"][0]["url"].startswith("/api/media/")
    assert posts[0]["media"][0]["type"] == "image"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
make test
```
Expected: 404 on `/api/accounts/nobody` but also 404 for `/api/accounts/alice` (route doesn't exist yet)

- [ ] **Step 3: Add imports and helpers to `api/routes/accounts.py`**

At the top of `api/routes/accounts.py`, update the imports:

```python
import asyncio
import base64
import logging
import random
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from ..config import DB_PATH, STORAGE_BASE
from ..db import (
    get_account_detail,
    get_account_posts,
    get_account_profile_pic_path,
    get_accounts_missing_profile_pic,
    get_all_accounts,
    save_account_profile_pic,
    upsert_following_accounts,
)
from ..loader import get_loader
```

Add these two helper functions right before `router = APIRouter()`:

```python
def _encode(filepath: str) -> str:
    return base64.urlsafe_b64encode(filepath.encode()).decode().rstrip("=")


def _media_type(ext: str) -> str:
    return "video" if ext == "mp4" else "image"
```

- [ ] **Step 4: Add the two route handlers to `api/routes/accounts.py`**

Add after the existing `@router.get("/accounts/{username}/avatar")` handler (must come after the avatar route so the more-specific `/avatar` sub-path is already registered):

```python
@router.get("/accounts/{username}")
async def get_account_detail_route(username: str):
    detail = await asyncio.to_thread(get_account_detail, username, DB_PATH)
    if detail is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return JSONResponse(detail)


@router.get("/accounts/{username}/posts")
async def get_account_posts_route(username: str):
    posts = await asyncio.to_thread(get_account_posts, username, DB_PATH)
    return JSONResponse({
        "posts": [
            {
                "account": p["account"],
                "account_active": p["account_active"],
                "caption": p["caption"],
                "post_timestamp": p["post_timestamp"],
                "shortcode": p["shortcode"],
                "archived_at": p["archived_at"],
                "favorited_at": p["favorited_at"],
                "media": [
                    {"url": f"/api/media/{_encode(fp)}", "type": _media_type(ext), "width": w, "height": h}
                    for fp, ext, w, h in p["media"]
                ],
            }
            for p in posts
        ]
    })
```

**Important:** In FastAPI, route order matters. The `GET /accounts/{username}` handler must be registered **after** the more specific `GET /accounts/{username}/avatar` handler to avoid `/avatar` being captured as a username. Verify the order in the file is:
1. `GET /accounts` (exact)
2. `POST /accounts/sync-following` (exact)
3. `GET /accounts/{username}/avatar` (specific sub-path first)
4. `GET /accounts/{username}` (generic, after specific)
5. `GET /accounts/{username}/posts`

- [ ] **Step 5: Run tests**

```bash
make test
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add api/routes/accounts.py tests/test_account_route.py
git commit -m "feat: add GET /api/accounts/{username} and GET /api/accounts/{username}/posts endpoints"
```

---

## Task 7: Avatar `size` prop

**Files:**
- Modify: `frontend/src/lib/Avatar.svelte`

- [ ] **Step 1: Update `Avatar.svelte` to accept a `size` prop**

Replace the full file content:

```svelte
<script>
  import { avatarColor, hideAvatarImage } from '$lib/media.js';
  let { account, active = true, size = 36 } = $props();
</script>

<div
  class="avatar-ring"
  class:inactive={!active}
  style="--size: {size}px; --font-size: {Math.round(size * 0.36)}px"
>
  <div class="avatar-inner" style="background: {avatarColor(account)}">
    <img
      class="avatar-img"
      src="/api/accounts/{account}/avatar"
      alt={account}
      onerror={hideAvatarImage}
    />
    {(account?.[0] ?? '').toUpperCase()}
  </div>
</div>

<style>
  .avatar-ring {
    width: var(--size, 36px);
    height: var(--size, 36px);
    border-radius: 50%;
    padding: 2px;
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
    flex-shrink: 0;
  }

  .avatar-ring.inactive {
    background: var(--color-border);
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
    font-size: var(--font-size, 13px);
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
</style>
```

- [ ] **Step 2: Verify existing usages still work**

All existing `<Avatar account={...} active={...} />` calls omit `size`, which defaults to `36` — no change in rendered output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/Avatar.svelte
git commit -m "feat: add size prop to Avatar component"
```

---

## Task 8: New frontend route `/accounts/[username]`

**Files:**
- Create: `frontend/src/routes/accounts/[username]/+page.js`
- Create: `frontend/src/routes/accounts/[username]/+page.svelte`

- [ ] **Step 1: Create `+page.js`**

Create `frontend/src/routes/accounts/[username]/+page.js`:

```js
export async function load({ fetch, params }) {
  try {
    const [profileRes, postsRes] = await Promise.all([
      fetch(`/api/accounts/${params.username}`),
      fetch(`/api/accounts/${params.username}/posts`),
    ]);
    const profile = profileRes.ok ? await profileRes.json() : null;
    const postsData = postsRes.ok ? await postsRes.json() : { posts: [] };
    return {
      profile,
      posts: Array.isArray(postsData?.posts) ? postsData.posts : [],
    };
  } catch {
    return { profile: null, posts: [] };
  }
}
```

- [ ] **Step 2: Create `+page.svelte`**

Create `frontend/src/routes/accounts/[username]/+page.svelte`:

```svelte
<script>
  import Avatar from '$lib/Avatar.svelte';

  let { data } = $props();
  const { profile, posts } = data;

  function displayUrl(url) {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
</script>

<div class="page">
  {#if !profile}
    <div class="not-found">Account not found.</div>
  {:else}
    <div class="profile-header">
      <div class="profile-top">
        <Avatar account={profile.username} active={profile.active} size={80} />
        <div class="profile-stats">
          <h1 class="profile-username">{profile.username}</h1>
          <p class="profile-counts">
            {profile.post_count.toLocaleString('en')} posts
            {#if profile.unrated_count > 0}
              · {profile.unrated_count.toLocaleString('en')} unrated
            {/if}
          </p>
          {#if profile.favorited_count > 0}
            <p class="profile-fav">
              {Math.round(profile.favorited_count / (profile.favorited_count + profile.archived_count) * 100)}% favorited
            </p>
          {/if}
        </div>
      </div>

      {#if profile.full_name || profile.bio || profile.external_url}
        <div class="profile-bio">
          {#if profile.full_name}
            <p class="profile-full-name">{profile.full_name}</p>
          {/if}
          {#if profile.bio}
            <p class="profile-bio-text">{profile.bio}</p>
          {/if}
          {#if profile.external_url}
            <a
              href={profile.external_url}
              target="_blank"
              rel="noopener noreferrer"
              class="profile-url"
            >
              {displayUrl(profile.external_url)}
            </a>
          {/if}
        </div>
      {/if}

      <a
        href="https://www.instagram.com/{profile.username}"
        target="_blank"
        rel="noopener noreferrer"
        class="instagram-link"
      >
        View on Instagram ↗
      </a>
    </div>

    {#if posts.length === 0}
      <p class="empty">No posts downloaded yet.</p>
    {:else}
      <div class="grid">
        {#each posts as post (post.shortcode ?? post.post_timestamp)}
          <div class="grid-cell">
            <img src={post.media[0]?.url} alt="" loading="lazy" />
            {#if post.media.length > 1}
              <span class="carousel-indicator" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="7" width="13" height="13" rx="2" stroke="white" stroke-width="1.5"/>
                  <path d="M5 5V4a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 470px;
    margin: 0 auto;
  }

  @media (min-width: 768px) {
    .page {
      max-width: 600px;
    }
  }

  .not-found {
    padding: 48px 20px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 14px;
  }

  /* Header */
  .profile-header {
    padding: 20px 16px 0;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 2px;
  }

  .profile-top {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 16px;
  }

  .profile-stats {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .profile-username {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-counts {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .profile-fav {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .profile-bio {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
  }

  .profile-full-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
  }

  .profile-bio-text {
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.5;
    white-space: pre-line;
  }

  .profile-url {
    font-size: 14px;
    font-weight: 600;
    color: #00376b;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }

  @media (prefers-color-scheme: dark) {
    .profile-url {
      color: #e0f1ff;
    }
  }

  .instagram-link {
    display: block;
    text-align: center;
    padding: 7px 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    text-decoration: none;
    margin-bottom: 16px;
  }

  @media (hover: hover) and (pointer: fine) {
    .instagram-link:hover {
      background: var(--color-border-subtle);
    }
  }

  /* Grid */
  .empty {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 14px;
    padding: 48px 20px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }

  .grid-cell {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    background: var(--color-border-subtle);
  }

  .grid-cell img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .carousel-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    pointer-events: none;
  }

  .carousel-indicator svg {
    width: 16px;
    height: 16px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }
</style>
```

- [ ] **Step 3: Start the dev server and verify the page**

```bash
make start
# In another terminal:
cd frontend && npm run dev
```

Navigate to `http://localhost:5173/accounts/<a-known-username>`. Verify:
- Avatar renders at 80px
- Username, post count, unrated count show correctly
- Bio/full_name/external_url appear if populated (re-run sync-following to populate them)
- "View on Instagram" opens Instagram in new tab
- Post grid renders 3 columns with correct thumbnails
- Carousel posts show the double-square indicator

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/accounts/
git commit -m "feat: add account page route /accounts/[username]"
```

---

## Task 9: Update existing account name links

**Files:**
- Modify: `frontend/src/lib/PostCard.svelte:134`
- Modify: `frontend/src/routes/following/+page.svelte:53`
- Modify: `frontend/src/routes/+layout.svelte:92`

- [ ] **Step 1: Update `PostCard.svelte`**

In `frontend/src/lib/PostCard.svelte`, replace line 134:

```svelte
        <a href="https://instagram.com/{post.account}" target="_blank" rel="noopener noreferrer">
```

With:

```svelte
        <a href="/accounts/{post.account}">
```

- [ ] **Step 2: Update `following/+page.svelte`**

In `frontend/src/routes/following/+page.svelte`, replace line 53:

```svelte
            <a class="username" id="account-{account.username}" href="https://www.instagram.com/{account.username}" target="_blank" rel="noopener noreferrer">
```

With:

```svelte
            <a class="username" id="account-{account.username}" href="/accounts/{account.username}">
```

- [ ] **Step 3: Update `+layout.svelte` — Following tab active state**

In `frontend/src/routes/+layout.svelte`, replace line 92:

```svelte
  <a href="/following" class="tab" class:active={$page.url.pathname === '/following'} aria-label="Following">
```

With:

```svelte
  <a href="/following" class="tab" class:active={$page.url.pathname === '/following' || $page.url.pathname.startsWith('/accounts')} aria-label="Following">
```

- [ ] **Step 4: Verify in browser**

- In the feed, click an account name → should navigate to `/accounts/<username>` (not Instagram)
- In `/following`, click an account name → same
- On any `/accounts/*` page, the Following tab in the nav bar should be highlighted

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/PostCard.svelte frontend/src/routes/following/+page.svelte frontend/src/routes/+layout.svelte
git commit -m "feat: route account name links to internal account page"
```

---

## Final verification

- [ ] **Run the full test suite**

```bash
make test
```
Expected: all tests pass, no regressions

- [ ] **Smoke-test the app end-to-end**

1. Feed page: account name link → `/accounts/<username>` ✓
2. Following page: account name link → `/accounts/<username>` ✓
3. Account page: avatar, stats, bio (if populated), "View on Instagram" button, grid ✓
4. Following tab highlights on all `/accounts/*` routes ✓
5. Sync-following: re-sync an account → bio fields populate ✓
