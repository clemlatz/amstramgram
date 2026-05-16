# Account Page — Design Spec

**Date:** 2026-05-14  
**Status:** Approved

## Overview

Add an Account page (`/account`) between the Choice (`/random`) and Stats (`/stats`) tabs. The page shows the currently connected Instagram account and allows updating the session ID with immediate hot-reload — no restart required.

The session ID moves from an environment variable to the SQLite database, eliminating `INSTAGRAM_SESSION_ID` from `.env`. The `SESSION_FILE`, `ENCRYPTION_KEY` env vars, and `crypto.py` are removed entirely.

---

## Backend

### Database — `settings` table

New table added to the existing SQLite DB (created on startup if absent):

```sql
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
```

Three keys are used:

| Key          | Value                              |
|--------------|------------------------------------|
| `session_id` | Raw Instagram sessionid cookie     |
| `cookies`    | JSON-serialised full cookie jar    |
| `username`   | Resolved Instagram username        |

Three helpers added to `db.py`: `get_setting(key: str) -> str | None`, `set_setting(key: str, value: str) -> None`, `delete_setting(key: str) -> None`.

### `config.py`

`INSTAGRAM_SESSION_ID`, `SESSION_FILE`, and `ENCRYPTION_KEY_HEX` are removed. Only structural env vars remain (`DB_PATH`, `STORAGE_BASE`, `PORT`, `DRY_RUN`, `ENABLE_SCHEDULER`, `ENABLE_ACCESS_LOG`).

### `loader.py`

- **Startup:** reads `session_id`, `cookies`, and `username` from DB. If `cookies` is present, injects the cookie jar into the loader without any network call. If DB is empty, `_loader` stays `None` (app starts without a session).
- **`get_loader() -> Instaloader | None`:** returns `None` if no session is configured (DB empty). Callers must handle `None`.
- **`reload_session(new_session_id: str) -> str`:** sets the raw `sessionid` cookie, calls `test_login()` (one network call), then saves `session_id`, `cookies`, and `username` to DB. Resets the `_loader` singleton so subsequent calls use the new session. Returns the resolved username. Raises an exception if auth fails.
- **`persist_session_cookies() -> None`:** serialises the current cookie jar from `_loader` and writes it to DB (`cookies` key). Called by the scheduler at the end of each cycle to capture any cookie refresh Instagram may have issued during the cycle.

`_persist_session`, `_load_saved_session`, `_encryption_key`, and `save_current_session` are removed. `crypto.py` is deleted.

### `scheduler.py`

- `_run_cycle()` calls `get_loader()`. If the result is `None`, logs a warning ("No session configured — skipping cycle") and returns immediately.
- The call to `save_current_session()` at the end of `_run_cycle` is replaced by `persist_session_cookies()`.
- The import of `save_current_session` is replaced by `persist_session_cookies`.

### Routes

**`GET /api/account`**  
Returns `{ "username": str | null, "session_id": str | null }` — both read from DB, no network call.

**`POST /api/account/session`**  
Body: `{ "session_id": "..." }`  
Calls `reload_session()`. On success: returns `{ "username": str }` with HTTP 200. On auth failure: returns HTTP 401 with `{ "detail": "Authentication failed" }`.

New file: `api/routes/account.py`. Registered in `main.py` under `/api`.

---

## Frontend

### Tab bar (layout)

Four tabs, left to right: Feed (`/`), Choice (`/random`), Account (`/account`), Stats (`/stats`).

Icon for Account: person silhouette (filled when active, outline when inactive) — consistent with existing icon style (SVG inline, 26×26).

**Bug fix:** the Stats tab currently checks `$page.url.pathname === '/infos'` for its active state — corrected to `'/stats'`.

### `/account` page

**`+page.js`:** calls `GET /api/account` and returns `{ username, session_id }`.

**`+page.svelte`:**

- Displays the resolved username (or "Not connected" in muted style if null).
- Shows the current session ID in a text input (pre-filled from `data.session_id`, or empty if null).
- "Update" button submits the new value via `POST /api/account/session`.
- Loading state: button disabled + visual indicator during the request.
- On success: username display updates to the newly resolved value.
- On error (401 or network failure): inline error message below the input.

Visual style follows the existing page conventions: `max-width: 470px`, `margin: 0 auto`, same spacing and typography as `/stats`.

---

## Migration

`INSTAGRAM_SESSION_ID` is no longer required in `.env`. On first startup with an empty DB, the app starts in an unauthenticated state. The operator opens `/account`, enters the session ID, and submits — this performs the first authentication and populates the DB. The scheduler activates on the next cycle once a valid session is present.

`.env.example` is updated to remove `INSTAGRAM_SESSION_ID`, `SESSION_FILE`, and `ENCRYPTION_KEY`.

`CLAUDE.md` is updated to reflect the removed env vars.
