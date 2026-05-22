# Telegram Scheduler Failure Notifications

**Date:** 2026-05-22  
**Status:** Approved

## Overview

Send a Telegram message when the background scheduler stops due to a critical, unrecoverable failure. Bot token and chat ID are optional environment variables; when absent the feature is silently disabled.

## Scope

**In scope:**
- Notify on the 3 critical failures that stop the scheduler permanently
- New `api/notifier.py` module with a single public function
- Two optional env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Tests for the notifier module

**Out of scope:**
- Notifications for transient failures (rate limit backoff, network errors) where the scheduler continues
- Per-account download errors
- Other notification channels

## Architecture

### New file: `api/notifier.py`

Single public function:

```python
def send_telegram_alert(text: str) -> None: ...
```

Behavior:
- If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is not set, returns immediately (no-op)
- Otherwise, POST to `https://api.telegram.org/bot{token}/sendMessage` via `urllib.request` (stdlib, no new dependency)
- Timeout: 10 seconds
- On any exception (network error, bad token, etc.): `logger.warning(...)` and return — never raises, never stops the scheduler

### `api/config.py` additions

```python
TELEGRAM_BOT_TOKEN: str | None = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID: str | None = os.getenv("TELEGRAM_CHAT_ID")
```

### `api/scheduler.py` — 3 call sites in `_scheduler_loop`

All are existing `logger.critical(...); return` branches:

| Trigger | Message sent |
|---|---|
| Rate limit exhausted (3 consecutive) | `⚠️ Scheduler stopped: rate limited {n} times consecutively.` |
| Session invalidated | `⚠️ Scheduler stopped: session invalidated ({ExcClassName}).` |
| Too many consecutive generic errors | `⚠️ Scheduler stopped: {n} consecutive errors — {exc}.` |

### `.env.example`

Two commented lines added:

```
# Telegram notifications on critical scheduler failure (optional)
# TELEGRAM_BOT_TOKEN=123456789:AABBCCDDEEFFaabbccddeeff
# TELEGRAM_CHAT_ID=-1001234567890
```

## Data Flow

```
scheduler_loop
  └─ critical failure
       ├─ logger.critical(...)
       ├─ send_telegram_alert(message)   ← new
       │    ├─ no config → return (no-op)
       │    └─ POST https://api.telegram.org/bot.../sendMessage
       │         ├─ success → return
       │         └─ error → logger.warning, return
       └─ return  (scheduler stops)
```

## Error Handling

- Telegram API errors are swallowed — a notification failure must never affect scheduler behavior
- Missing configuration is treated as "disabled", not an error

## Testing

File: `tests/test_notifier.py`

| Test | Scenario |
|---|---|
| `test_no_op_when_not_configured` | No env vars → `urlopen` never called |
| `test_sends_message_when_configured` | Both env vars set → correct URL called with `chat_id` and `text` in body |
| `test_swallows_network_error` | `urlopen` raises → function returns without raising |
