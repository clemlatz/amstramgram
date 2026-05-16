# Scheduler Control from Settings Page

## Overview

Add start/stop control for the download scheduler on the settings page. The scheduler state is persisted in the database and always resets to stopped on server start.

## Behavior

- The scheduler starts as **stopped** every time the server boots, regardless of previous state.
- Stopping the scheduler sets a `threading.Event`. The event is checked before each new download (per post, per account). In-progress downloads and sleeps are not interrupted — no new download begins once the event is set.
- Starting the scheduler clears the event and resumes from the stored `next_run_at` (already persisted in the `settings` table at the end of each cycle). If the stored time is in the past, a new cycle begins after 60 seconds.
- `ENABLE_SCHEDULER` env var is removed entirely. The scheduler is controlled only via the UI/API.

## Backend

### `api/config.py`

Remove `ENABLE_SCHEDULER`.

### `api/scheduler.py`

Add two module-level globals:

```python
_stop_event: threading.Event = threading.Event()
_scheduler_task: asyncio.Task | None = None
```

**Stop checks** — `_stop_event.is_set()` checked in:
- `_fetch_new_posts()`: before each call to `_download_account_fast()`
- `_fetch_old_posts()`: before each account iteration
- `_download_account_fast()`: before each `L.download_post()` call

When the event is set, the function returns early without starting a new download.

**Rename** current `start_scheduler()` → `_scheduler_loop()` (private).

**New public functions:**

```python
async def start_scheduler() -> None:
    # Clears stop_event, sets scheduler_enabled=true in DB, creates asyncio task

async def stop_scheduler() -> None:
    # Sets stop_event, sets scheduler_enabled=false in DB, cancels asyncio task

def get_scheduler_status() -> dict:
    # Returns {"running": bool, "next_run_at": str | None}
```

`start_scheduler()` is idempotent: no-op if a task is already running.
`stop_scheduler()` is idempotent: no-op if no task is running.

### `api/main.py`

Remove `asyncio.create_task(start_scheduler())` from lifespan.

Add on startup:

```python
set_setting("scheduler_enabled", "false", DB_PATH)
```

The scheduler is never auto-started.

### `api/routes/settings.py`

Enrich `GET /api/settings` response:

```json
{
  "username": "...",
  "session_id": "...",
  "user_agent": "...",
  "scheduler_running": false,
  "next_run_at": "2026-05-16T10:30:00" // or null
}
```

Add two endpoints:

```
POST /api/settings/scheduler/start  → {"running": true}
POST /api/settings/scheduler/stop   → {"running": false}
```

## Frontend

### `frontend/src/routes/settings/+page.js`

`load()` already returns the full `GET /api/settings` payload — no change needed, new fields are automatically available.

### `frontend/src/routes/settings/+page.svelte`

Add a "Scheduler" section (same visual style as existing sections) between User-Agent and the end of the page.

Contents:
- Status label: "Running" or "Stopped"
- Next cycle time (shown only when running and `next_run_at` is available): e.g., "Next cycle at 10:30"
- A single button: "Start" when stopped, "Stop" when running
- Loading state while the API call is in flight

No new CSS classes needed beyond what already exists (`.btn`, `.label`, `.divider`, `.saved`/`.error` patterns).
