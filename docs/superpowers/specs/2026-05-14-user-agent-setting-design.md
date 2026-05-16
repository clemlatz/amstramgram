# User-Agent Setting — Design Spec

## Overview

Allow the user to configure a custom HTTP User-Agent string from the Settings page. The value is stored in the existing `settings` DB table and applied by the scheduler before each download cycle.

## Background

Two UA strings currently exist in the codebase:

- `loader.py:_make_instaloader()` — Instaloader constructor default (Linux/Chrome UA, never overridden by user)
- `scheduler.py:_set_session_headers()` — hardcoded iPhone UA that overwrites the session headers before every download cycle

The new setting replaces the hardcoded iPhone UA in `_set_session_headers()`.

## Backend

### GET /api/settings (existing)

Add `user_agent` to the response JSON. Value is `get_setting("user_agent", DB_PATH)`, which may be `null`.

### POST /api/settings/user-agent (new)

```
Body: { "user_agent": "<string>" }
```

- Calls `set_setting("user_agent", body.user_agent, DB_PATH)`
- Returns `{ "ok": true }`
- Empty string is treated as "reset to default" — calls `delete_setting("user_agent", DB_PATH)` instead

### scheduler.py — _set_session_headers()

Replace hardcoded iPhone UA with a DB lookup:

```python
def _set_session_headers(L: instaloader.Instaloader) -> None:
    ua = get_setting("user_agent", DB_PATH) or "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 ...)"
    L.context._session.headers.update({
        "X-IG-App-ID": "936619743392459",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.instagram.com/",
        "User-Agent": ua,
    })
```

The fallback string is the exact iPhone UA currently hardcoded.

## Frontend

New section added below the existing Session ID form in `frontend/src/routes/settings/+page.svelte`.

- `data.user_agent` loaded from `GET /api/settings`
- Separate `<form>` with its own `loading` / `error` state
- `<input type="text">` — placeholder is the iPhone UA fallback string (so the user sees what the default is)
- Submit calls `POST /api/settings/user-agent`
- On success: no page reload needed
- Styling: identical to existing Session ID form fields

## Data flow

```
User pastes UA → POST /api/settings/user-agent → set_setting("user_agent", ...)
                                                         ↓
                                         Next scheduler cycle reads from DB
                                         via _set_session_headers()
```

## Out of scope

- Applying the UA immediately to a running loader without waiting for the next cycle
- Validating UA string format
- Preset UA options
