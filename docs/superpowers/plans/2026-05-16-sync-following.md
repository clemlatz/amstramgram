# Sync Following Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual "Sync following" button in settings that fetches the authenticated user's Instagram following list and inserts new accounts into the local DB as active.

**Architecture:** New DB helper `upsert_following_accounts` handles insertion. New route `POST /api/accounts/sync-following` fetches the following list via Instaloader's iPhone API (paginated) and calls the helper. A new button in the settings page calls this endpoint and shows the result.

**Tech Stack:** Python/FastAPI, SQLite, Instaloader iPhone JSON API, SvelteKit (Svelte 5 runes)

---

## File Map

| File | Change |
|---|---|
| `api/db.py` | Add `upsert_following_accounts` |
| `api/routes/accounts.py` | Add `POST /api/accounts/sync-following` endpoint |
| `tests/test_sync_following.py` | New file — DB helper tests + route tests |
| `frontend/src/routes/settings/+page.svelte` | Add sync section (state + function + markup) |

---

## Task 1: DB helper — `upsert_following_accounts`

**Files:**
- Modify: `api/db.py`
- Create: `tests/test_sync_following.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_sync_following.py`:

```python
import pytest
from api.db import init_db, upsert_following_accounts


@pytest.fixture()
def db(tmp_path):
    path = tmp_path / "test.db"
    init_db(path)
    return path


def test_upsert_inserts_new_accounts(db):
    accounts = [
        {"username": "alice", "instagram_user_id": "111"},
        {"username": "bob",   "instagram_user_id": "222"},
    ]
    added = upsert_following_accounts(accounts, db)
    assert added == 2


def test_upsert_ignores_existing_username(db):
    accounts = [{"username": "alice", "instagram_user_id": "111"}]
    upsert_following_accounts(accounts, db)
    added = upsert_following_accounts(accounts, db)
    assert added == 0


def test_upsert_counts_only_new_rows(db):
    upsert_following_accounts([{"username": "alice", "instagram_user_id": "111"}], db)
    added = upsert_following_accounts([
        {"username": "alice", "instagram_user_id": "111"},
        {"username": "bob",   "instagram_user_id": "222"},
    ], db)
    assert added == 1


def test_upsert_sets_active_flag(db):
    import sqlite3
    upsert_following_accounts([{"username": "carol", "instagram_user_id": "333"}], db)
    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT active FROM accounts WHERE username = 'carol'").fetchone()
    conn.close()
    assert row[0] == 1


def test_upsert_stores_instagram_user_id(db):
    import sqlite3
    upsert_following_accounts([{"username": "dave", "instagram_user_id": "444"}], db)
    conn = sqlite3.connect(str(db))
    row = conn.execute("SELECT instagram_user_id FROM accounts WHERE username = 'dave'").fetchone()
    conn.close()
    assert row[0] == "444"


def test_upsert_empty_list_returns_zero(db):
    assert upsert_following_accounts([], db) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/clement/Developer/amstramgram
.venv/bin/pytest tests/test_sync_following.py -v 2>&1 | head -30
```

Expected: `ImportError` or `AttributeError` — `upsert_following_accounts` not defined yet.

- [ ] **Step 3: Implement `upsert_following_accounts` in `api/db.py`**

Add after `get_all_accounts` (around line 378):

```python
def upsert_following_accounts(accounts: list[dict], db_path: Path) -> int:
    if not accounts:
        return 0
    conn = _conn(db_path)
    try:
        before = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        conn.executemany(
            "INSERT OR IGNORE INTO accounts (username, instagram_user_id, active) VALUES (?, ?, 1)",
            [(a["username"], a["instagram_user_id"]) for a in accounts],
        )
        conn.commit()
        after = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        return after - before
    finally:
        conn.close()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
.venv/bin/pytest tests/test_sync_following.py -v
```

Expected: 6 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add api/db.py tests/test_sync_following.py
git commit -m "feat: add upsert_following_accounts DB helper"
```

---

## Task 2: Backend endpoint `POST /api/accounts/sync-following`

**Files:**
- Modify: `api/routes/accounts.py`
- Modify: `tests/test_sync_following.py`

- [ ] **Step 1: Write the failing route tests**

Append to `tests/test_sync_following.py`:

```python
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from api.main import app


@pytest.fixture()
def client(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.routes.accounts.DB_PATH", db):
        yield TestClient(app), db


def _make_loader(following_pages):
    """Build a mock Instaloader whose get_iphone_json returns the given pages in order."""
    mock_L = MagicMock()
    current_user_resp = {"user": {"pk": "99999"}}
    responses = [current_user_resp] + following_pages
    mock_L.context.get_iphone_json.side_effect = responses
    return mock_L


def test_sync_returns_400_when_no_session(client):
    tc, _ = client
    with patch("api.routes.accounts.get_loader", return_value=None):
        resp = tc.post("/api/accounts/sync-following")
    assert resp.status_code == 400


def test_sync_inserts_accounts_and_returns_count(client):
    tc, _ = client
    page = {"users": [{"username": "alice", "pk": "111"}, {"username": "bob", "pk": "222"}]}
    mock_L = _make_loader([page])
    with patch("api.routes.accounts.get_loader", return_value=mock_L):
        resp = tc.post("/api/accounts/sync-following")
    assert resp.status_code == 200
    assert resp.json() == {"added": 2}


def test_sync_paginates_until_no_next_cursor(client):
    tc, _ = client
    page1 = {"users": [{"username": "alice", "pk": "111"}], "next_max_id": "cursor_abc"}
    page2 = {"users": [{"username": "bob",   "pk": "222"}]}
    mock_L = _make_loader([page1, page2])
    with patch("api.routes.accounts.get_loader", return_value=mock_L):
        resp = tc.post("/api/accounts/sync-following")
    assert resp.status_code == 200
    assert resp.json() == {"added": 2}


def test_sync_returns_zero_when_all_accounts_exist(client):
    tc, db = client
    upsert_following_accounts([{"username": "alice", "instagram_user_id": "111"}], db)
    page = {"users": [{"username": "alice", "pk": "111"}]}
    mock_L = _make_loader([page])
    with patch("api.routes.accounts.get_loader", return_value=mock_L):
        resp = tc.post("/api/accounts/sync-following")
    assert resp.status_code == 200
    assert resp.json() == {"added": 0}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
.venv/bin/pytest tests/test_sync_following.py::test_sync_returns_400_when_no_session -v
```

Expected: FAIL — route `POST /api/accounts/sync-following` does not exist yet.

- [ ] **Step 3: Implement the endpoint in `api/routes/accounts.py`**

Replace the entire file:

```python
import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import DB_PATH
from ..db import get_all_accounts, upsert_following_accounts
from ..loader import get_loader

router = APIRouter()


@router.get("/accounts")
async def get_accounts_route():
    accounts = await asyncio.to_thread(get_all_accounts, DB_PATH)
    return JSONResponse(accounts)


@router.post("/accounts/sync-following")
async def sync_following_route():
    L = get_loader()
    if L is None:
        return JSONResponse({"detail": "No session configured"}, status_code=400)
    try:
        added = await asyncio.to_thread(_fetch_and_upsert_following, L)
    except Exception as exc:
        return JSONResponse({"detail": str(exc)}, status_code=500)
    return JSONResponse({"added": added})


def _fetch_and_upsert_following(L) -> int:
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
            })
        next_cursor = data.get("next_max_id")
        if not next_cursor:
            break
        params = {"count": 200, "max_id": next_cursor}

    return upsert_following_accounts(accounts, DB_PATH)
```

- [ ] **Step 4: Run all route tests to verify they pass**

```bash
.venv/bin/pytest tests/test_sync_following.py -v
```

Expected: all 10 tests PASSED.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
.venv/bin/pytest tests/ -v 2>&1 | tail -20
```

Expected: all tests PASSED.

- [ ] **Step 6: Commit**

```bash
git add api/routes/accounts.py tests/test_sync_following.py
git commit -m "feat: add POST /api/accounts/sync-following endpoint"
```

---

## Task 3: Frontend — Sync following button in settings

**Files:**
- Modify: `frontend/src/routes/settings/+page.svelte`

No tests for Svelte — verify manually by running the dev server.

- [ ] **Step 1: Add state variables**

In the `<script>` block of `frontend/src/routes/settings/+page.svelte`, after the existing state declarations (after line `let schedulerLoading = $state(false);`), add:

```javascript
  let syncLoading = $state(false);
  let syncResult = $state(null);
  let syncError = $state(null);
```

- [ ] **Step 2: Add the `syncFollowing` function**

In the `<script>` block, after `toggleScheduler()`, add:

```javascript
  async function syncFollowing() {
    syncLoading = true;
    syncResult = null;
    syncError = null;
    try {
      const res = await fetch('/api/accounts/sync-following', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        syncResult = json.added;
      } else {
        syncError = 'Sync failed. Please try again.';
      }
    } catch {
      syncError = 'Network error. Please try again.';
    } finally {
      syncLoading = false;
    }
  }
```

- [ ] **Step 3: Add the sync section to the template**

After the `</div>` that closes `.scheduler-section` (around line 168), add:

```html
  <div class="divider"></div>

  <div class="sync-section">
    <span class="field-label">Following sync</span>
    {#if syncResult !== null}
      <span class="label">{syncResult === 0 ? 'Already up to date' : `${syncResult} new account${syncResult === 1 ? '' : 's'} added`}</span>
    {:else}
      <span class="label">Import accounts from your Instagram following list</span>
    {/if}
    {#if syncError}
      <p class="error">{syncError}</p>
    {/if}
    <button class="btn" type="button" disabled={syncLoading} onclick={syncFollowing}>
      {syncLoading ? 'Syncing…' : 'Sync now'}
    </button>
  </div>
```

- [ ] **Step 4: Add CSS for `.sync-section`**

In the `<style>` block, after `.scheduler-section { ... }`, add:

```css
  .sync-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
```

- [ ] **Step 5: Manual verification**

Start the backend and frontend:

```bash
# Terminal 1
cd /Users/clement/Developer/amstramgram && python -m api

# Terminal 2
cd /Users/clement/Developer/amstramgram/frontend && npm run dev
```

Open `http://localhost:5173/settings`. Verify:
- "Sync now" button appears below the scheduler section.
- Clicking it shows "Syncing…" while loading.
- On success shows `"N new accounts added"` or `"Already up to date"`.
- On error (e.g. no session configured) shows error message.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/settings/+page.svelte
git commit -m "feat: add sync following button to settings page"
```
