# Account Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `/account` page between Choice and Stats tabs, showing the connected Instagram username and allowing the session ID to be updated with immediate hot-reload — no restart needed.

**Architecture:** The session ID moves from the `INSTAGRAM_SESSION_ID` env var to a `settings` table in the existing SQLite DB. The loader reads from DB on startup (restoring the full cookie jar with no network call); on session update it calls `test_login()` once and saves all credentials back. `crypto.py` and `SESSION_FILE` are removed entirely.

**Tech Stack:** Python / FastAPI / SQLite / Instaloader / SvelteKit (Svelte 5 runes)

---

## File map

| Action | Path |
|--------|------|
| Modify | `api/db.py` — add `settings` table + 3 helpers |
| Modify | `api/config.py` — remove 3 env vars |
| Rewrite | `api/loader.py` — DB-backed session management |
| Modify | `api/scheduler.py` — handle `None` loader, swap `save_current_session` |
| Create | `api/routes/account.py` — GET + POST handlers |
| Modify | `api/main.py` — register account router |
| Modify | `conftest.py` — remove obsolete env var setup |
| Delete | `api/crypto.py` |
| Create | `tests/test_account_db.py` — settings DB helpers |
| Create | `tests/test_loader.py` — loader unit tests (mocked) |
| Create | `tests/test_account_route.py` — route tests via TestClient |
| Modify | `frontend/src/routes/+layout.svelte` — add Account tab, fix stats bug |
| Create | `frontend/src/routes/account/+page.js` |
| Create | `frontend/src/routes/account/+page.svelte` |
| Modify | `.env.example` — remove obsolete vars |
| Modify | `CLAUDE.md` — update env vars table |

---

## Task 1: DB — `settings` table and helpers

**Files:**
- Modify: `api/db.py`
- Create: `tests/test_account_db.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_account_db.py`:

```python
import sqlite3
from pathlib import Path

import pytest

from api.db import init_db, get_setting, set_setting, delete_setting


def test_init_db_creates_settings_table(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    conn = sqlite3.connect(str(db))
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    assert "settings" in tables


def test_get_setting_returns_none_when_missing(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert get_setting("session_id", db) is None


def test_set_and_get_setting(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    set_setting("session_id", "abc123", db)
    assert get_setting("session_id", db) == "abc123"


def test_set_setting_overwrites_existing(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    set_setting("session_id", "old", db)
    set_setting("session_id", "new", db)
    assert get_setting("session_id", db) == "new"


def test_delete_setting_removes_key(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    set_setting("username", "alice", db)
    delete_setting("username", db)
    assert get_setting("username", db) is None


def test_delete_setting_is_safe_when_key_missing(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    delete_setting("nonexistent", db)  # must not raise
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
.venv/bin/python -m pytest tests/test_account_db.py -v
```

Expected: FAIL — `ImportError: cannot import name 'get_setting'`

- [ ] **Step 3: Add `settings` table to `init_db` in `api/db.py`**

Inside the `conn.executescript("""...""")` block in `init_db`, append after the `ratings` table definition and before the closing `""")`:

```sql
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
```

- [ ] **Step 4: Add the three helper functions at the bottom of `api/db.py`**

```python
def get_setting(key: str, db_path: Path) -> str | None:
    conn = _conn(db_path, read_only=True)
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None
    finally:
        conn.close()


def set_setting(key: str, value: str, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)"
            " ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        conn.commit()
    finally:
        conn.close()


def delete_setting(key: str, db_path: Path) -> None:
    conn = _conn(db_path)
    try:
        conn.execute("DELETE FROM settings WHERE key = ?", (key,))
        conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
.venv/bin/python -m pytest tests/test_account_db.py -v
```

Expected: 6 PASSED

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected: all existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add api/db.py tests/test_account_db.py
git commit -m "feat: add settings table and helpers to db"
```

---

## Task 2: Loader rewrite

**Files:**
- Rewrite: `api/loader.py`
- Create: `tests/test_loader.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_loader.py`:

```python
import json
from unittest.mock import MagicMock, patch

import pytest

from api.db import get_setting, init_db


@pytest.fixture(autouse=True)
def reset_loader():
    import api.loader
    api.loader._loader = None
    yield
    api.loader._loader = None


def _make_mock_L():
    cookie = MagicMock()
    cookie.name = "sessionid"
    cookie.value = "val"
    cookie.domain = ".instagram.com"
    cookie.path = "/"

    cookies = MagicMock()
    cookies.__iter__ = MagicMock(return_value=iter([cookie]))

    context = MagicMock()
    context._session.cookies = cookies
    context.username = None

    L = MagicMock()
    L.context = context
    return L


def test_get_loader_returns_none_when_no_session_in_db(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.loader.DB_PATH", db), \
         patch("api.loader._make_instaloader") as mock_make:
        from api.loader import get_loader
        result = get_loader()
    assert result is None
    mock_make.assert_not_called()


def test_get_loader_restores_cookies_without_test_login(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    from api.db import set_setting
    cookies_data = json.dumps([
        {"name": "sessionid", "value": "sid", "domain": ".instagram.com", "path": "/"}
    ])
    set_setting("session_id", "sid123", db)
    set_setting("cookies", cookies_data, db)
    set_setting("username", "alice", db)

    mock_L = _make_mock_L()
    with patch("api.loader.DB_PATH", db), \
         patch("api.loader._make_instaloader", return_value=mock_L):
        import api.loader
        api.loader._loader = None
        result = api.loader.get_loader()

    mock_L.test_login.assert_not_called()
    assert result is mock_L
    assert mock_L.context.username == "alice"


def test_reload_session_calls_test_login_and_saves_to_db(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    mock_L = _make_mock_L()
    mock_L.test_login.return_value = "alice"

    with patch("api.loader.DB_PATH", db), \
         patch("api.loader._make_instaloader", return_value=mock_L):
        from api.loader import reload_session
        username = reload_session("newsid")

    assert username == "alice"
    mock_L.test_login.assert_called_once()
    assert get_setting("session_id", db) == "newsid"
    assert get_setting("username", db) == "alice"
    assert get_setting("cookies", db) is not None


def test_reload_session_raises_on_auth_failure(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    mock_L = _make_mock_L()
    mock_L.test_login.return_value = None

    with patch("api.loader.DB_PATH", db), \
         patch("api.loader._make_instaloader", return_value=mock_L):
        from api.loader import reload_session
        with pytest.raises(ValueError, match="Authentication failed"):
            reload_session("badsid")


def test_persist_session_cookies_saves_cookies_to_db(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    mock_L = _make_mock_L()

    with patch("api.loader.DB_PATH", db):
        import api.loader
        api.loader._loader = mock_L
        api.loader.persist_session_cookies()

    cookies_json = get_setting("cookies", db)
    assert cookies_json is not None
    cookies = json.loads(cookies_json)
    assert any(c["name"] == "sessionid" for c in cookies)


def test_persist_session_cookies_does_nothing_when_no_loader(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.loader.DB_PATH", db):
        import api.loader
        api.loader._loader = None
        api.loader.persist_session_cookies()  # must not raise
    assert get_setting("cookies", db) is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
.venv/bin/python -m pytest tests/test_loader.py -v
```

Expected: FAIL — `ImportError` or attribute errors from the old loader API

- [ ] **Step 3: Rewrite `api/loader.py`**

Replace the entire file content with:

```python
import json
import logging

import instaloader

from .config import DB_PATH, STORAGE_BASE
from .db import get_setting, set_setting

logger = logging.getLogger(__name__)

_loader: instaloader.Instaloader | None = None


def get_loader() -> instaloader.Instaloader | None:
    global _loader
    if _loader is None:
        _loader = _build_loader()
    return _loader


def _make_instaloader() -> instaloader.Instaloader:
    L = instaloader.Instaloader(
        dirname_pattern=str(STORAGE_BASE / "{target}"),
        download_pictures=True,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=True,
        compress_json=False,
        post_metadata_txt_pattern="",
        storyitem_metadata_txt_pattern="",
        quiet=True,
    )

    def _quiet_error(msg, repeat_at_end=True):
        if repeat_at_end:
            L.context.error_log.append(msg)
    L.context.error = _quiet_error
    return L


def _build_loader() -> instaloader.Instaloader | None:
    session_id = get_setting("session_id", DB_PATH)
    if not session_id:
        logger.info("No session configured — loader inactive")
        return None

    L = _make_instaloader()
    cookies_json = get_setting("cookies", DB_PATH)

    if cookies_json:
        for c in json.loads(cookies_json):
            L.context._session.cookies.set(
                c["name"], c["value"],
                domain=c.get("domain", ".instagram.com"),
                path=c.get("path", "/"),
            )
        username = get_setting("username", DB_PATH)
        L.context.username = username
        logger.info("Loaded persisted session for %s (no network call)", username)
    else:
        L.context._session.cookies.set("sessionid", session_id, domain=".instagram.com", path="/")
        username = L.test_login()
        if username:
            L.context.username = username
            _save_all_to_db(L, session_id)
            logger.info("Authenticated as %s", username)
        else:
            logger.error("Authentication failed — update session ID at /account")

    return L


def reload_session(new_session_id: str) -> str:
    global _loader
    L = _make_instaloader()
    L.context._session.cookies.set("sessionid", new_session_id, domain=".instagram.com", path="/")
    username = L.test_login()
    if not username:
        raise ValueError("Authentication failed")
    L.context.username = username
    _save_all_to_db(L, new_session_id)
    _loader = L
    logger.info("Session reloaded for %s", username)
    return username


def persist_session_cookies() -> None:
    if _loader is None:
        return
    cookies_list = [
        {"name": c.name, "value": c.value, "domain": c.domain, "path": c.path}
        for c in _loader.context._session.cookies
    ]
    set_setting("cookies", json.dumps(cookies_list), DB_PATH)


def _save_all_to_db(L: instaloader.Instaloader, session_id: str) -> None:
    set_setting("session_id", session_id, DB_PATH)
    set_setting("username", L.context.username, DB_PATH)
    persist_session_cookies()
```

- [ ] **Step 4: Run loader tests**

```bash
.venv/bin/python -m pytest tests/test_loader.py -v
```

Expected: 6 PASSED

- [ ] **Step 5: Commit**

```bash
git add api/loader.py tests/test_loader.py
git commit -m "feat: rewrite loader to store session in DB"
```

---

## Task 3: Config cleanup

**Files:**
- Modify: `api/config.py`
- Modify: `conftest.py`
- Delete: `api/crypto.py`

- [ ] **Step 1: Replace `api/config.py`**

```python
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _path(key: str, default: str) -> Path:
    return Path(os.getenv(key, default)).expanduser()


DB_PATH = _path("DB_PATH", "/storage/amstragram/amstramgram.db")
STORAGE_BASE = _path("STORAGE_BASE", "/storage/instagram")
PORT: int = int(os.getenv("PORT", "8000"))
DRY_RUN: bool = os.getenv("DRY_RUN", "").lower() in ("1", "true", "yes")
ENABLE_SCHEDULER: bool = os.getenv("ENABLE_SCHEDULER", "").lower() in ("1", "true", "yes")
ENABLE_ACCESS_LOG: bool = os.getenv("ENABLE_ACCESS_LOG", "").lower() in ("1", "true", "yes")
```

- [ ] **Step 2: Update `conftest.py`**

Replace the entire file:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
```

- [ ] **Step 3: Delete `api/crypto.py`**

```bash
git rm api/crypto.py
```

- [ ] **Step 4: Run full test suite**

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected: all tests pass (no imports of `crypto.py` or `INSTAGRAM_SESSION_ID` remain)

- [ ] **Step 5: Commit**

```bash
git add api/config.py conftest.py
git commit -m "chore: remove INSTAGRAM_SESSION_ID env var and crypto.py"
```

---

## Task 4: Scheduler update

**Files:**
- Modify: `api/scheduler.py`

- [ ] **Step 1: Update import in `api/scheduler.py`**

Change line:
```python
from .loader import get_loader, save_current_session
```
to:
```python
from .loader import get_loader, persist_session_cookies
```

- [ ] **Step 2: Update `_run_cycle` to handle `None` loader**

Replace this block in `_run_cycle`:
```python
    L = get_loader()
    if not L.context.username:
        raise Exception("Not authenticated — refresh INSTAGRAM_SESSION_ID")
```
with:
```python
    L = get_loader()
    if L is None:
        logger.warning("No session configured — skipping cycle")
        return
    if not L.context.username:
        logger.warning("No authenticated user — skipping cycle")
        return
```

- [ ] **Step 3: Replace `save_current_session()` call**

At the end of `_run_cycle`, replace:
```python
    save_current_session()
```
with:
```python
    persist_session_cookies()
```

- [ ] **Step 4: Update the session-invalidated log message**

Replace:
```python
            logger.critical("Session invalidated — scheduler stopped. Refresh INSTAGRAM_SESSION_ID. (%s)", exc)
```
with:
```python
            logger.critical("Session invalidated — scheduler stopped. Update session ID at /account. (%s)", exc)
```

- [ ] **Step 5: Run full test suite**

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add api/scheduler.py
git commit -m "feat: update scheduler to use DB-backed session"
```

---

## Task 5: Account route

**Files:**
- Create: `api/routes/account.py`
- Modify: `api/main.py`
- Modify: `requirements-dev.txt`
- Create: `tests/test_account_route.py`

- [ ] **Step 1: Add `httpx` to `requirements-dev.txt`**

```
pytest>=8.0
pytest-asyncio>=0.23
httpx>=0.27
```

Install it:

```bash
.venv/bin/pip install httpx
```

- [ ] **Step 2: Write failing tests**

Create `tests/test_account_route.py`:

```python
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.db import init_db, set_setting
from api.main import app


@pytest.fixture()
def client(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.routes.account.DB_PATH", db):
        yield TestClient(app), db


def test_get_account_returns_nulls_when_no_session(client):
    tc, _ = client
    resp = tc.get("/api/account")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] is None
    assert data["session_id"] is None


def test_get_account_returns_stored_values(client):
    tc, db = client
    set_setting("username", "alice", db)
    set_setting("session_id", "sid123", db)
    resp = tc.get("/api/account")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "alice"
    assert data["session_id"] == "sid123"


def test_post_session_returns_username_on_success(client):
    tc, _ = client
    with patch("api.routes.account.reload_session", return_value="alice"):
        resp = tc.post("/api/account/session", json={"session_id": "newsid"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"


def test_post_session_returns_401_on_auth_failure(client):
    tc, _ = client
    with patch("api.routes.account.reload_session", side_effect=ValueError("Authentication failed")):
        resp = tc.post("/api/account/session", json={"session_id": "badsid"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Authentication failed"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
.venv/bin/python -m pytest tests/test_account_route.py -v
```

Expected: FAIL — `ImportError: cannot import name 'account'` from routes

- [ ] **Step 4: Create `api/routes/account.py`**

```python
import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..config import DB_PATH
from ..db import get_setting
from ..loader import reload_session

router = APIRouter()


class _SessionBody(BaseModel):
    session_id: str


@router.get("/account")
async def get_account():
    username = get_setting("username", DB_PATH)
    session_id = get_setting("session_id", DB_PATH)
    return JSONResponse({"username": username, "session_id": session_id})


@router.post("/account/session")
async def update_session(body: _SessionBody):
    try:
        username = await asyncio.to_thread(reload_session, body.session_id)
        return JSONResponse({"username": username})
    except Exception:
        return JSONResponse({"detail": "Authentication failed"}, status_code=401)
```

- [ ] **Step 5: Register the router in `api/main.py`**

Change:
```python
from .routes import feed, image, random, rate, stats
```
to:
```python
from .routes import account, feed, image, random, rate, stats
```

Add after `app.include_router(stats.router, prefix="/api")`:
```python
app.include_router(account.router, prefix="/api")
```

- [ ] **Step 6: Run route tests**

```bash
.venv/bin/python -m pytest tests/test_account_route.py -v
```

Expected: 4 PASSED

- [ ] **Step 7: Run full test suite**

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add api/routes/account.py api/main.py requirements-dev.txt tests/test_account_route.py
git commit -m "feat: add account route GET /api/account and POST /api/account/session"
```

---

## Task 6: Frontend — tab bar

**Files:**
- Modify: `frontend/src/routes/+layout.svelte`

- [ ] **Step 1: Add the Account tab between `/random` and `/stats`**

In `+layout.svelte`, insert this block between the closing `</a>` of the `/random` tab and the opening `<a href="/stats"` of the stats tab:

```svelte
  <a href="/account" class="tab" class:active={$page.url.pathname === '/account'} aria-label="Account">
    {#if $page.url.pathname === '/account'}
      <!-- Person filled -->
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="4" fill="currentColor"/>
        <path d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7" fill="currentColor"/>
      </svg>
    {:else}
      <!-- Person outline -->
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.75"/>
        <path d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
    {/if}
  </a>
```

- [ ] **Step 2: Fix the stats tab active-state bug**

The stats tab `<a>` element has `class:active={$page.url.pathname === '/stats'}` correct on the `<a>` tag, but the `{#if}` block inside checks `'/infos'`. Fix it:

Change:
```svelte
    {#if $page.url.pathname === '/infos'}
```
to:
```svelte
    {#if $page.url.pathname === '/stats'}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/+layout.svelte
git commit -m "feat: add Account tab to nav bar, fix Stats active state"
```

---

## Task 7: Frontend — Account page

**Files:**
- Create: `frontend/src/routes/account/+page.js`
- Create: `frontend/src/routes/account/+page.svelte`

- [ ] **Step 1: Create `frontend/src/routes/account/+page.js`**

```javascript
export async function load({ fetch }) {
  const res = await fetch('/api/account');
  if (!res.ok) return { username: null, session_id: null };
  return res.json();
}
```

- [ ] **Step 2: Create `frontend/src/routes/account/+page.svelte`**

```svelte
<script>
  let { data } = $props();

  let username = $state(data.username);
  let sessionId = $state(data.session_id ?? '');
  let loading = $state(false);
  let error = $state(null);

  async function handleSubmit(e) {
    e.preventDefault();
    loading = true;
    error = null;
    try {
      const res = await fetch('/api/account/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        const json = await res.json();
        username = json.username;
      } else {
        error = 'Authentication failed. Check your session ID.';
      }
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="page">
  <div class="account-info">
    {#if username}
      <span class="username">@{username}</span>
      <span class="label">connected account</span>
    {:else}
      <span class="username muted">Not connected</span>
    {/if}
  </div>

  <form class="form" onsubmit={handleSubmit}>
    <label class="field-label" for="session-id">Session ID</label>
    <input
      id="session-id"
      class="input"
      type="text"
      bind:value={sessionId}
      placeholder="Paste your Instagram sessionid cookie"
      autocomplete="off"
      spellcheck="false"
    />
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <button class="btn" type="submit" disabled={loading || !sessionId.trim()}>
      {loading ? 'Connecting…' : 'Update'}
    </button>
  </form>
</div>

<style>
  .page {
    max-width: 470px;
    margin: 0 auto;
    padding: 32px 20px 16px;
  }

  .account-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 24px;
  }

  .username {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.5px;
    line-height: 1;
  }

  .username.muted {
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .label {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }

  .input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    font-family: inherit;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    outline: none;
  }

  .input:focus {
    border-color: var(--color-text);
  }

  .error {
    font-size: 13px;
    color: #e03131;
    margin: 0;
  }

  .btn {
    align-self: flex-start;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    color: var(--color-bg);
    background: var(--color-text);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn:not(:disabled):active {
    opacity: 0.7;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/account/
git commit -m "feat: add Account page with session ID update form"
```

---

## Task 8: Docs and env cleanup

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `.env.example`**

Replace the entire file with:

```bash
# FastAPI backend port (local dev)
PORT=8000

# Enable background download scheduler
# Without this, only the web server runs; no media is downloaded.
# ENABLE_SCHEDULER=true

# Enable HTTP access logs (disabled by default)
# ENABLE_ACCESS_LOG=true

# Storage paths (defaults are for Docker; uncomment and set for local dev)
# DB_PATH=~/path/to/amstramgram.db
# STORAGE_BASE=~/path/to/instagram
```

- [ ] **Step 2: Update the env vars table in `CLAUDE.md`**

Replace the Environment variables table:

```markdown
## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | FastAPI backend port in dev (default: `8000`) |
| `DB_PATH` | No | SQLite database path |
| `STORAGE_BASE` | No | Media storage root directory |

> The Instagram session ID is stored in the database and managed via the `/account` page.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: remove obsolete env vars from .env.example and CLAUDE.md"
```
