# Scheduler Control from Settings Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add start/stop control for the download scheduler on the settings page, with state persisted in the database and always reset to stopped on server start.

**Architecture:** A `threading.Event` (`_stop_event`) signals download loops to stop before the next download. A `asyncio.Task` reference (`_scheduler_task`) allows cancellation of the sleep between cycles. Public `start_scheduler()` / `stop_scheduler()` functions manage both; two new API endpoints expose them; the settings page gains a toggle button.

**Tech Stack:** Python 3.12+, FastAPI, asyncio, threading, SQLite (via existing `get_setting`/`set_setting`), SvelteKit (Svelte 5 runes syntax)

---

### Task 1: Remove `ENABLE_SCHEDULER` env var

**Files:**
- Modify: `api/config.py`
- Modify: `api/scheduler.py`

- [ ] **Step 1: Remove `ENABLE_SCHEDULER` from `api/config.py`**

Delete this line:
```python
ENABLE_SCHEDULER: bool = os.getenv("ENABLE_SCHEDULER", "").lower() in ("1", "true", "yes")
```

- [ ] **Step 2: Update the import in `api/scheduler.py`**

Change:
```python
from .config import DB_PATH, DRY_RUN, ENABLE_SCHEDULER, STORAGE_BASE
```
To:
```python
from .config import DB_PATH, DRY_RUN, STORAGE_BASE
```

- [ ] **Step 3: Remove the `ENABLE_SCHEDULER` guard from `start_scheduler()`**

The current `start_scheduler()` begins with:
```python
async def start_scheduler() -> None:
    if not ENABLE_SCHEDULER:
        logger.info("Scheduler disabled (ENABLE_SCHEDULER not set) — web server only")
        return
    logger.info("Scheduler started")
    consecutive_rl = 0
    next_delay = _load_next_delay()
    ...
```

Rename this function to `_scheduler_loop()` and remove the guard + the log line:
```python
async def _scheduler_loop() -> None:
    consecutive_rl = 0
    next_delay = _load_next_delay()
    ...
```

The rest of the body is unchanged.

- [ ] **Step 4: Run existing tests to verify nothing is broken**

```bash
python -m pytest tests/test_scheduler.py -v
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/config.py api/scheduler.py
git commit -m "refactor: remove ENABLE_SCHEDULER env var, rename internal loop"
```

---

### Task 2: Add `_stop_event` global and stop checks in download functions

**Files:**
- Modify: `api/scheduler.py`
- Modify: `tests/test_scheduler.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_scheduler.py`:

```python
def test_fetch_new_posts_stops_when_stop_event_set(tmp_path):
    from api import scheduler as sched
    from api.scheduler import _fetch_new_posts

    sched._stop_event.set()
    try:
        active_accounts = [(1, "111", "alice", 1)]
        with patch("api.scheduler._download_account_fast") as mock_dl:
            _fetch_new_posts(MagicMock(), active_accounts, tmp_path / "test.db")
        mock_dl.assert_not_called()
    finally:
        sched._stop_event.clear()


def test_fetch_old_posts_stops_when_stop_event_set(tmp_path):
    from api import scheduler as sched
    from api.scheduler import _fetch_old_posts

    sched._stop_event.set()
    try:
        with patch("api.scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 5, 10, 10, 0)
            with patch("api.scheduler.get_unsynced_accounts", return_value=[(1, "111", "alice")]):
                with patch("instaloader.Profile.from_iphone_struct") as mock_struct:
                    _fetch_old_posts(MagicMock(), tmp_path / "test.db")
        mock_struct.assert_not_called()
    finally:
        sched._stop_event.clear()


def test_download_account_fast_stops_when_stop_event_set(tmp_path):
    from api import scheduler as sched
    from api.scheduler import _download_account_fast

    (tmp_path / "111").mkdir()
    sched._stop_event.set()
    try:
        L = MagicMock()
        L.context.get_iphone_json.return_value = {"user": {}}
        profile = MagicMock()
        profile.get_posts.return_value = [MagicMock()]
        with patch("instaloader.Profile.from_iphone_struct", return_value=profile):
            with patch("api.scheduler.STORAGE_BASE", tmp_path):
                with patch("api.scheduler.index_account", return_value=0):
                    _download_account_fast(L, 1, "111", "alice", tmp_path / "test.db")
        L.download_post.assert_not_called()
    finally:
        sched._stop_event.clear()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_scheduler.py::test_fetch_new_posts_stops_when_stop_event_set tests/test_scheduler.py::test_fetch_old_posts_stops_when_stop_event_set tests/test_scheduler.py::test_download_account_fast_stops_when_stop_event_set -v
```

Expected: FAIL with `AttributeError: module 'api.scheduler' has no attribute '_stop_event'`

- [ ] **Step 3: Add `_stop_event` global to `api/scheduler.py`**

Add `import threading` at the top of the imports block, then add the global after the existing module-level constants:

```python
_stop_event: threading.Event = threading.Event()
```

- [ ] **Step 4: Add stop check in `_download_account_fast()` before each `download_post` call**

In the `for post in profile.get_posts():` loop, add the check as the first line:

```python
        for post in profile.get_posts():
            if _stop_event.is_set():
                return
            if not L.download_post(post, target=username):
                break
            time.sleep(_lognormal_delay(2, 5))
```

- [ ] **Step 5: Add stop check in `_fetch_new_posts()` before each account download**

In the inner `for a_idx, ...` loop, add the check as the first line:

```python
        for a_idx, (account_id, ig_id, username) in enumerate(group):
            if _stop_event.is_set():
                return
            _download_account_fast(L, account_id, ig_id, username, db_path)
            if a_idx < len(group) - 1:
                _sleep(_lognormal_delay(30, 90))
```

- [ ] **Step 6: Add stop check in `_fetch_old_posts()` before each account download**

In the `for i, (account_id, instagram_user_id, username) in enumerate(candidates):` loop, add the check as the first line:

```python
    for i, (account_id, instagram_user_id, username) in enumerate(candidates):
        if _stop_event.is_set():
            return
        dest = STORAGE_BASE / instagram_user_id
        ...
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
python -m pytest tests/test_scheduler.py -v
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add api/scheduler.py tests/test_scheduler.py
git commit -m "feat: add stop_event checks before each download"
```

---

### Task 3: Add public scheduler control functions

**Files:**
- Modify: `api/scheduler.py`
- Modify: `tests/test_scheduler.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_scheduler.py`:

```python
def test_get_scheduler_status_stopped_when_no_task():
    from api import scheduler as sched
    from api.scheduler import get_scheduler_status

    original_task = sched._scheduler_task
    sched._scheduler_task = None
    try:
        with patch("api.scheduler.get_setting", return_value=None):
            status = get_scheduler_status()
        assert status["running"] is False
        assert status["next_run_at"] is None
    finally:
        sched._scheduler_task = original_task


def test_get_scheduler_status_returns_next_run_at():
    from api import scheduler as sched
    from api.scheduler import get_scheduler_status

    original_task = sched._scheduler_task
    sched._scheduler_task = None
    try:
        with patch("api.scheduler.get_setting", return_value="2026-05-16T10:30:00"):
            status = get_scheduler_status()
        assert status["next_run_at"] == "2026-05-16T10:30:00"
    finally:
        sched._scheduler_task = original_task
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_scheduler.py::test_get_scheduler_status_stopped_when_no_task tests/test_scheduler.py::test_get_scheduler_status_returns_next_run_at -v
```

Expected: FAIL with `ImportError: cannot import name 'get_scheduler_status'`

- [ ] **Step 3: Add `_scheduler_task` global and three public functions to `api/scheduler.py`**

Add the global right after `_stop_event`:

```python
_scheduler_task: asyncio.Task | None = None
```

Add these three functions at the end of the file (after `_scheduler_loop`):

```python
async def start_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return
    _stop_event.clear()
    set_setting("scheduler_enabled", "true", DB_PATH)
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("Scheduler started")


async def stop_scheduler() -> None:
    global _scheduler_task
    set_setting("scheduler_enabled", "false", DB_PATH)
    _stop_event.set()
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
    _scheduler_task = None
    logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    running = _scheduler_task is not None and not _scheduler_task.done()
    try:
        next_run_at = get_setting("next_run_at", DB_PATH)
    except Exception:
        next_run_at = None
    return {"running": running, "next_run_at": next_run_at}
```

- [ ] **Step 4: Run all scheduler tests**

```bash
python -m pytest tests/test_scheduler.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/scheduler.py tests/test_scheduler.py
git commit -m "feat: add public start_scheduler, stop_scheduler, get_scheduler_status"
```

---

### Task 4: Update `main.py` — no auto-start, reset state on startup

**Files:**
- Modify: `api/main.py`

- [ ] **Step 1: Update imports in `api/main.py`**

Remove the `start_scheduler` import, remove the `import asyncio` line (no longer needed), and add `set_setting` to the db import:

```python
from .db import init_db, set_setting
```

The `import asyncio` and `from .scheduler import start_scheduler` lines are deleted entirely.

- [ ] **Step 2: Update the lifespan function**

Replace:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(DB_PATH)
    asyncio.create_task(start_scheduler())
    yield
```

With:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(DB_PATH)
    set_setting("scheduler_enabled", "false", DB_PATH)
    yield
```

- [ ] **Step 3: Verify the server starts correctly**

```bash
python -m api
```

Expected: server starts, no scheduler log line ("Scheduler started" does not appear), no errors.

Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add api/main.py
git commit -m "feat: scheduler always starts stopped on server boot"
```

---

### Task 5: Add scheduler endpoints to the settings route

**Files:**
- Modify: `api/routes/settings.py`
- Modify: `tests/test_account_route.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_account_route.py`:

```python
def test_get_settings_includes_scheduler_fields(client):
    tc, _ = client
    with patch("api.routes.settings.get_scheduler_status", return_value={"running": False, "next_run_at": None}):
        resp = tc.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["scheduler_running"] is False
    assert data["next_run_at"] is None


def test_post_scheduler_start_returns_running_true(client):
    tc, _ = client
    with patch("api.routes.settings.start_scheduler") as mock_start:
        resp = tc.post("/api/settings/scheduler/start")
    assert resp.status_code == 200
    assert resp.json() == {"running": True}
    mock_start.assert_called_once()


def test_post_scheduler_stop_returns_running_false(client):
    tc, _ = client
    with patch("api.routes.settings.stop_scheduler") as mock_stop:
        resp = tc.post("/api/settings/scheduler/stop")
    assert resp.status_code == 200
    assert resp.json() == {"running": False}
    mock_stop.assert_called_once()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_account_route.py::test_get_settings_includes_scheduler_fields tests/test_account_route.py::test_post_scheduler_start_returns_running_true tests/test_account_route.py::test_post_scheduler_stop_returns_running_false -v
```

Expected: FAIL — `scheduler_running` key missing in GET response, POST endpoints return 404.

- [ ] **Step 3: Update `api/routes/settings.py`**

Add imports at the top:

```python
from ..scheduler import get_scheduler_status, start_scheduler, stop_scheduler
```

Replace the existing `get_settings` handler:

```python
@router.get("/settings")
async def get_settings():
    username = get_setting("username", DB_PATH)
    session_id = get_setting("session_id", DB_PATH)
    user_agent = get_setting("user_agent", DB_PATH)
    status = get_scheduler_status()
    return JSONResponse({
        "username": username,
        "session_id": session_id,
        "user_agent": user_agent,
        "scheduler_running": status["running"],
        "next_run_at": status["next_run_at"],
    })
```

Add two new endpoints after `update_user_agent`:

```python
@router.post("/settings/scheduler/start")
async def start_scheduler_endpoint():
    await start_scheduler()
    return JSONResponse({"running": True})


@router.post("/settings/scheduler/stop")
async def stop_scheduler_endpoint():
    await stop_scheduler()
    return JSONResponse({"running": False})
```

- [ ] **Step 4: Run all route tests**

```bash
python -m pytest tests/test_account_route.py -v
```

Expected: all tests pass. (The existing `test_get_settings_returns_nulls_when_no_session` still passes — it doesn't assert that `scheduler_running` is absent, and `get_scheduler_status()` handles DB errors gracefully.)

- [ ] **Step 5: Commit**

```bash
git add api/routes/settings.py tests/test_account_route.py
git commit -m "feat: add scheduler start/stop endpoints and status in GET /api/settings"
```

---

### Task 6: Add scheduler toggle to the settings page

**Files:**
- Modify: `frontend/src/routes/settings/+page.svelte`

(`+page.js` needs no change — it returns the full API payload already.)

- [ ] **Step 1: Add state variables and `toggleScheduler` function to the `<script>` block**

After the existing `uaSaved` variable declaration, add:

```javascript
let schedulerRunning = $state(data.scheduler_running ?? false);
let nextRunAt = $state(data.next_run_at ?? null);
let schedulerLoading = $state(false);
```

After the `handleUaSubmit` function, add:

```javascript
async function toggleScheduler() {
    schedulerLoading = true;
    const action = schedulerRunning ? 'stop' : 'start';
    try {
        const res = await fetch(`/api/settings/scheduler/${action}`, { method: 'POST' });
        if (res.ok) {
            const json = await res.json();
            schedulerRunning = json.running;
            if (!schedulerRunning) nextRunAt = null;
        }
    } catch {
        // silently ignore network errors
    } finally {
        schedulerLoading = false;
    }
}
```

- [ ] **Step 2: Add the Scheduler section to the template**

After the closing `</form>` tag of the User-Agent form (and its preceding `<div class="divider"></div>`), add:

```html
  <div class="divider"></div>

  <div class="scheduler-section">
    <span class="field-label">Scheduler</span>
    <div class="scheduler-status-row">
      <span class="label">{schedulerRunning ? 'Running' : 'Stopped'}</span>
      {#if schedulerRunning && nextRunAt}
        <span class="label">&nbsp;— Next cycle at {new Date(nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      {/if}
    </div>
    <button class="btn" onclick={toggleScheduler} disabled={schedulerLoading}>
      {schedulerLoading ? '…' : schedulerRunning ? 'Stop' : 'Start'}
    </button>
  </div>
```

- [ ] **Step 3: Add CSS for the new section**

Add inside the `<style>` block:

```css
  .scheduler-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .scheduler-status-row {
    display: flex;
    align-items: center;
  }
```

- [ ] **Step 4: Start the dev server and test the UI**

```bash
# Terminal 1
python -m api

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173/settings`.

Verify:
- Scheduler section is visible with status "Stopped"
- Clicking "Start" calls POST /api/settings/scheduler/start and button switches to "Stop"
- Clicking "Stop" calls POST /api/settings/scheduler/stop and button switches to "Start"
- After refreshing the page, status always shows "Stopped" (server reset on startup)
- If `next_run_at` is set in DB, it appears when scheduler is running

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/settings/+page.svelte
git commit -m "feat: add scheduler start/stop toggle to settings page"
```

---

### Task 7: Full test run

- [ ] **Step 1: Run the full test suite**

```bash
python -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 2: Verify in Docker (optional)**

```bash
docker compose up --build -d
```

Open the app, check that the scheduler section appears on the settings page and that start/stop works.
