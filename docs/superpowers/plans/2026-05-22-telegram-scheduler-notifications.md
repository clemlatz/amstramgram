# Telegram Scheduler Failure Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a Telegram message when the background scheduler stops due to a critical, unrecoverable error.

**Architecture:** A new `api/notifier.py` module exposes a single `send_telegram_alert(text)` function that POSTs to the Telegram Bot API using `urllib.request` (stdlib). Two optional env vars (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) gate the feature; when absent, the function is a silent no-op. The function is called at the 3 existing `logger.critical(...); return` branches in `_scheduler_loop`.

**Tech Stack:** Python stdlib (`urllib.request`, `urllib.parse`), pytest, `unittest.mock`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `api/config.py` | Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` optional env vars |
| Create | `api/notifier.py` | `send_telegram_alert(text)` — Telegram HTTP call, no-op when unconfigured |
| Modify | `api/scheduler.py` | Import and call `send_telegram_alert` at 3 critical failure sites |
| Modify | `.env.example` | Document the two new optional variables |
| Create | `tests/test_notifier.py` | 3 tests: no-op, success, error swallowing |

---

### Task 1: Add Telegram env vars to config and document them

**Files:**
- Modify: `api/config.py`
- Modify: `.env.example`

- [ ] **Step 1: Add two optional vars to `api/config.py`**

  Append at the end of the file (after `ENABLE_ACCESS_LOG`):

  ```python
  TELEGRAM_BOT_TOKEN: str | None = os.getenv("TELEGRAM_BOT_TOKEN")
  TELEGRAM_CHAT_ID: str | None = os.getenv("TELEGRAM_CHAT_ID")
  ```

- [ ] **Step 2: Document them in `.env.example`**

  Append at the end of `.env.example`:

  ```
  # Telegram notifications on critical scheduler failure (optional)
  # TELEGRAM_BOT_TOKEN=123456789:AABBCCDDEEFFaabbccddeeff
  # TELEGRAM_CHAT_ID=-1001234567890
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add api/config.py .env.example
  git commit -m "feat: add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars"
  ```

---

### Task 2: Write failing tests for `api/notifier.py`

**Files:**
- Create: `tests/test_notifier.py`

- [ ] **Step 1: Create `tests/test_notifier.py` with 3 failing tests**

  ```python
  from unittest.mock import MagicMock, patch

  from api.notifier import send_telegram_alert


  def test_no_op_when_not_configured():
      with patch("api.notifier.TELEGRAM_BOT_TOKEN", None), \
           patch("api.notifier.TELEGRAM_CHAT_ID", None), \
           patch("urllib.request.urlopen") as mock_urlopen:
          send_telegram_alert("test message")
          mock_urlopen.assert_not_called()


  def test_sends_message_when_configured():
      mock_cm = MagicMock()
      mock_cm.__enter__ = MagicMock(return_value=mock_cm)
      mock_cm.__exit__ = MagicMock(return_value=False)

      with patch("api.notifier.TELEGRAM_BOT_TOKEN", "test-token"), \
           patch("api.notifier.TELEGRAM_CHAT_ID", "12345"), \
           patch("urllib.request.urlopen", return_value=mock_cm) as mock_urlopen:
          send_telegram_alert("Scheduler stopped")

          mock_urlopen.assert_called_once()
          call_args = mock_urlopen.call_args
          url = call_args.args[0]
          data = call_args.kwargs["data"]
          assert "test-token" in url
          assert b"chat_id=12345" in data
          assert b"Scheduler+stopped" in data or b"Scheduler%20stopped" in data


  def test_swallows_network_error():
      with patch("api.notifier.TELEGRAM_BOT_TOKEN", "test-token"), \
           patch("api.notifier.TELEGRAM_CHAT_ID", "12345"), \
           patch("urllib.request.urlopen", side_effect=OSError("network error")):
          send_telegram_alert("test message")  # must not raise
  ```

- [ ] **Step 2: Run the tests — expect ImportError (module doesn't exist yet)**

  ```bash
  .venv/bin/python -m pytest tests/test_notifier.py -v
  ```

  Expected: `ImportError: cannot import name 'send_telegram_alert' from 'api.notifier'` or `ModuleNotFoundError`

---

### Task 3: Implement `api/notifier.py` and make tests pass

**Files:**
- Create: `api/notifier.py`

- [ ] **Step 1: Create `api/notifier.py`**

  ```python
  import logging
  import urllib.parse
  import urllib.request

  from .config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

  logger = logging.getLogger(__name__)


  def send_telegram_alert(text: str) -> None:
      if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
          return
      url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
      data = urllib.parse.urlencode({"chat_id": TELEGRAM_CHAT_ID, "text": text}).encode()
      try:
          with urllib.request.urlopen(url, data=data, timeout=10):
              pass
      except Exception as exc:
          logger.warning("Telegram alert failed: %s", exc)
  ```

- [ ] **Step 2: Run the tests — expect all 3 to pass**

  ```bash
  .venv/bin/python -m pytest tests/test_notifier.py -v
  ```

  Expected:
  ```
  tests/test_notifier.py::test_no_op_when_not_configured PASSED
  tests/test_notifier.py::test_sends_message_when_configured PASSED
  tests/test_notifier.py::test_swallows_network_error PASSED
  ```

- [ ] **Step 3: Run the full test suite — expect no regressions**

  ```bash
  .venv/bin/python -m pytest tests/ -v
  ```

  Expected: all previously passing tests still pass.

- [ ] **Step 4: Commit**

  ```bash
  git add api/notifier.py tests/test_notifier.py
  git commit -m "feat: add Telegram alert notifier with tests"
  ```

---

### Task 4: Wire `send_telegram_alert` into `_scheduler_loop`

**Files:**
- Modify: `api/scheduler.py`

The `_scheduler_loop` function has 3 branches that stop the scheduler with `logger.critical(...); return`. Each needs one call to `send_telegram_alert` inserted between the `logger.critical` call and the `return`.

- [ ] **Step 1: Add the import at the top of `api/scheduler.py`**

  Find the existing import block at the top of `scheduler.py` (the `.` relative imports). Add:

  ```python
  from .notifier import send_telegram_alert
  ```

  Place it after the existing relative imports (after the `from .loader import ...` line).

- [ ] **Step 2: Patch call site 1 — rate limit exhausted**

  Find this block in `_scheduler_loop` (inside `except RateLimitException as exc:`):

  ```python
              if consecutive_rl >= _RATE_LIMIT_MAX_RETRIES:
                  logger.critical(
                      "Rate limited %d times consecutively — scheduler stopped. (%s)",
                      consecutive_rl,
                      exc,
                  )
                  return
  ```

  Replace with:

  ```python
              if consecutive_rl >= _RATE_LIMIT_MAX_RETRIES:
                  logger.critical(
                      "Rate limited %d times consecutively — scheduler stopped. (%s)",
                      consecutive_rl,
                      exc,
                  )
                  send_telegram_alert(
                      f"⚠️ Scheduler stopped: rate limited {consecutive_rl} times consecutively."
                  )
                  return
  ```

- [ ] **Step 3: Patch call site 2 — session invalidated**

  Find this block in `_scheduler_loop`:

  ```python
          except _SESSION_INVALIDATED_EXCEPTIONS as exc:
              logger.critical(
                  "Session invalidated — scheduler stopped. Update session ID at /settings. (%s)",
                  exc,
              )
              return
  ```

  Replace with:

  ```python
          except _SESSION_INVALIDATED_EXCEPTIONS as exc:
              logger.critical(
                  "Session invalidated — scheduler stopped. Update session ID at /settings. (%s)",
                  exc,
              )
              send_telegram_alert(
                  f"⚠️ Scheduler stopped: session invalidated ({type(exc).__name__})."
              )
              return
  ```

- [ ] **Step 4: Patch call site 3 — too many consecutive generic errors**

  Find this block in `_scheduler_loop` (inside the final `except Exception as exc:`):

  ```python
              if consecutive_rl >= _RATE_LIMIT_MAX_RETRIES:
                  logger.critical(
                      "Too many consecutive errors (%d) — scheduler stopped: %s",
                      consecutive_rl,
                      exc,
                  )
                  return
  ```

  Replace with:

  ```python
              if consecutive_rl >= _RATE_LIMIT_MAX_RETRIES:
                  logger.critical(
                      "Too many consecutive errors (%d) — scheduler stopped: %s",
                      consecutive_rl,
                      exc,
                  )
                  send_telegram_alert(
                      f"⚠️ Scheduler stopped: {consecutive_rl} consecutive errors — {exc}."
                  )
                  return
  ```

- [ ] **Step 5: Run the full test suite — expect no regressions**

  ```bash
  .venv/bin/python -m pytest tests/ -v
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add api/scheduler.py
  git commit -m "feat: notify Telegram on critical scheduler failures"
  ```
