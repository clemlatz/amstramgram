# Archive Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Archive" action on the account page that disables sync, hides the account, and marks all its posts as archived in ratings.

**Architecture:** DB function executes both operations in one transaction. Dedicated REST endpoint calls it. Frontend adds an inline confirm/cancel button on the account profile page.

**Tech Stack:** Python/FastAPI (backend), SQLite (storage), SvelteKit + Svelte 5 runes (frontend)

---

## Files

- Modify: `api/db.py` — add `archive_account(username, db_path) -> bool`
- Modify: `api/routes/accounts.py` — add `POST /api/accounts/{username}/archive`
- Modify: `frontend/src/routes/accounts/[username]/+page.svelte` — add Archive button
- Modify: `tests/test_account_db.py` — tests for `archive_account`
- Modify: `tests/test_account_route.py` — test for the new route

---

## Task 1: DB function `archive_account`

**Files:**
- Modify: `api/db.py` (append after `set_account_hidden`)
- Modify: `tests/test_account_db.py` (append new tests)

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_account_db.py`:

```python
from api.db import archive_account


def test_archive_account_returns_false_for_unknown_username(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    assert archive_account("nobody", db) is False


def test_archive_account_sets_active_and_hidden(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    conn.execute("UPDATE accounts SET active=1 WHERE username='alice'")
    conn.commit()
    conn.close()

    result = archive_account("alice", db)

    assert result is True
    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT active, hidden FROM accounts WHERE username='alice'"
    ).fetchone()
    conn.close()
    assert row[0] == 0
    assert row[1] == 1


def test_archive_account_archives_all_shortcodes(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username='alice'"
    ).fetchone()[0]
    conn.close()

    _insert_media(db, account_id, "sc1")
    _insert_media(db, account_id, "sc2")

    archive_account("alice", db)

    conn = sqlite3.connect(str(db))
    rows = conn.execute(
        "SELECT shortcode, archived_at, favorited_at FROM ratings ORDER BY shortcode"
    ).fetchall()
    conn.close()
    assert len(rows) == 2
    assert rows[0][0] == "sc1"
    assert rows[0][1] is not None   # archived_at set
    assert rows[0][2] is None       # favorited_at cleared
    assert rows[1][0] == "sc2"
    assert rows[1][1] is not None


def test_archive_account_overwrites_existing_ratings(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "alice", "platform_user_id": "111"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username='alice'"
    ).fetchone()[0]
    conn.close()

    _insert_media(db, account_id, "sc1")
    _insert_rating(db, "sc1", favorited=True)

    archive_account("alice", db)

    conn = sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT archived_at, favorited_at FROM ratings WHERE shortcode='sc1'"
    ).fetchone()
    conn.close()
    assert row[0] is not None   # archived_at set
    assert row[1] is None       # favorited_at cleared
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/clement/Developer/amstramgram && .venv/bin/pytest tests/test_account_db.py::test_archive_account_returns_false_for_unknown_username tests/test_account_db.py::test_archive_account_sets_active_and_hidden tests/test_account_db.py::test_archive_account_archives_all_shortcodes tests/test_account_db.py::test_archive_account_overwrites_existing_ratings -v
```

Expected: 4 failures with `ImportError` or `cannot import name 'archive_account'`.

- [ ] **Step 3: Implement `archive_account` in `api/db.py`**

Add after `set_account_hidden` (line ~884):

```python
def archive_account(username: str, db_path: Path) -> bool:
    conn = _conn(db_path)
    try:
        result = conn.execute(
            "UPDATE accounts SET active=0, hidden=1 WHERE username=?",
            (username,),
        )
        if result.rowcount == 0:
            return False
        conn.execute(
            """
            INSERT OR REPLACE INTO ratings (shortcode, archived_at, favorited_at)
            SELECT DISTINCT shortcode, datetime('now'), NULL
            FROM media
            WHERE account_id = (SELECT id FROM accounts WHERE username=?)
              AND shortcode IS NOT NULL
            """,
            (username,),
        )
        conn.commit()
        return True
    finally:
        conn.close()
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/clement/Developer/amstramgram && .venv/bin/pytest tests/test_account_db.py::test_archive_account_returns_false_for_unknown_username tests/test_account_db.py::test_archive_account_sets_active_and_hidden tests/test_account_db.py::test_archive_account_archives_all_shortcodes tests/test_account_db.py::test_archive_account_overwrites_existing_ratings -v
```

Expected: 4 PASSED.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/clement/Developer/amstramgram && .venv/bin/pytest -x -q
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add api/db.py tests/test_account_db.py
git commit -m "feat: add archive_account db function"
```

---

## Task 2: Route `POST /api/accounts/{username}/archive`

**Files:**
- Modify: `api/routes/accounts.py`
- Modify: `tests/test_account_route.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_account_route.py`. The existing `client` fixture patches `api.routes.settings.DB_PATH`; create a separate fixture that patches `api.routes.accounts.DB_PATH`. Add `import sqlite3 as _sqlite3` at the top of the file if not already present.

```python
import sqlite3 as _sqlite3


@pytest.fixture()
def accounts_client(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    with patch("api.routes.accounts.DB_PATH", db):
        yield TestClient(app), db


def _insert_account_with_media(db, username, platform_user_id, shortcodes):
    conn = _sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO accounts (username, platform_user_id, active) VALUES (?, ?, 1)",
        (username, platform_user_id),
    )
    account_id = conn.execute(
        "SELECT id FROM accounts WHERE username=?", (username,)
    ).fetchone()[0]
    for sc in shortcodes:
        conn.execute(
            "INSERT INTO media (account_id, filename, filepath, extension, shortcode)"
            " VALUES (?, ?, ?, 'jpg', ?)",
            (account_id, f"{sc}.jpg", f"{username}/{sc}.jpg", sc),
        )
    conn.commit()
    conn.close()


def test_archive_account_route_returns_404_for_unknown(accounts_client):
    tc, _ = accounts_client
    resp = tc.post("/api/accounts/nobody/archive")
    assert resp.status_code == 404


def test_archive_account_route_returns_archived_true(accounts_client):
    tc, db = accounts_client
    _insert_account_with_media(db, "alice", "111", ["sc1", "sc2"])
    resp = tc.post("/api/accounts/alice/archive")
    assert resp.status_code == 200
    assert resp.json() == {"archived": True}


def test_archive_account_route_marks_account_inactive_and_hidden(accounts_client):
    tc, db = accounts_client
    _insert_account_with_media(db, "alice", "111", ["sc1"])
    tc.post("/api/accounts/alice/archive")
    conn = _sqlite3.connect(str(db))
    row = conn.execute(
        "SELECT active, hidden FROM accounts WHERE username='alice'"
    ).fetchone()
    conn.close()
    assert row[0] == 0
    assert row[1] == 1


def test_archive_account_route_archives_all_posts(accounts_client):
    tc, db = accounts_client
    _insert_account_with_media(db, "alice", "111", ["sc1", "sc2"])
    tc.post("/api/accounts/alice/archive")
    conn = _sqlite3.connect(str(db))
    rows = conn.execute(
        "SELECT shortcode FROM ratings WHERE archived_at IS NOT NULL ORDER BY shortcode"
    ).fetchall()
    conn.close()
    assert [r[0] for r in rows] == ["sc1", "sc2"]
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/clement/Developer/amstramgram && .venv/bin/pytest tests/test_account_route.py::test_archive_account_route_returns_404_for_unknown tests/test_account_route.py::test_archive_account_route_returns_archived_true tests/test_account_route.py::test_archive_account_route_marks_account_inactive_and_hidden tests/test_account_route.py::test_archive_account_route_archives_all_posts -v
```

Expected: 4 failures (404 or method not allowed).

- [ ] **Step 3: Add the route to `api/routes/accounts.py`**

Add the import at the top of the file:

```python
from ..db import (
    ...
    archive_account,
    ...
)
```

Add after the `patch_account_route` handler:

```python
@router.post("/accounts/{username}/archive")
async def archive_account_route(username: str):
    archived = await asyncio.to_thread(archive_account, username, DB_PATH)
    if not archived:
        raise HTTPException(status_code=404, detail="Account not found")
    return JSONResponse({"archived": True})
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/clement/Developer/amstramgram && .venv/bin/pytest tests/test_account_route.py::test_archive_account_route_returns_404_for_unknown tests/test_account_route.py::test_archive_account_route_returns_archived_true tests/test_account_route.py::test_archive_account_route_marks_account_inactive_and_hidden tests/test_account_route.py::test_archive_account_route_archives_all_posts -v
```

Expected: 4 PASSED.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/clement/Developer/amstramgram && .venv/bin/pytest -x -q
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add api/routes/accounts.py tests/test_account_route.py
git commit -m "feat: add POST /api/accounts/{username}/archive route"
```

---

## Task 3: Frontend Archive button

**Files:**
- Modify: `frontend/src/routes/accounts/[username]/+page.svelte`

- [ ] **Step 1: Add archive state and handler to the script block**

In `<script>`, add after the `hidden` state variable:

```js
let archiveConfirming = $state(false);

async function archiveAccount() {
  try {
    const res = await fetch(`/api/accounts/${profile.username}/archive`, {
      method: 'POST',
    });
    if (res.ok) {
      window.location.href = '/following';
    }
  } catch {
    archiveConfirming = false;
  }
}
```

- [ ] **Step 2: Add Archive button(s) to `profile-actions`**

Replace the existing `<div class="profile-actions">` block with:

```svelte
<div class="profile-actions">
  <a
    href="https://www.instagram.com/{profile.username}"
    target="_blank"
    rel="noopener noreferrer"
    class="profile-action-btn"
  >
    View on Instagram ↗
  </a>
  <button class="profile-action-btn" class:inactive={!active} onclick={toggleActive}>
    {active ? 'Disable' : 'Enable'}
  </button>
  <button class="profile-action-btn" class:hidden-btn={hidden} onclick={toggleHidden}>
    {hidden ? 'Show' : 'Hide'}
  </button>
  {#if archiveConfirming}
    <button class="profile-action-btn archive-confirm" onclick={archiveAccount}>Confirm?</button>
    <button class="profile-action-btn" onclick={() => (archiveConfirming = false)}>Cancel</button>
  {:else}
    <button class="profile-action-btn" onclick={() => (archiveConfirming = true)}>Archive</button>
  {/if}
</div>
```

- [ ] **Step 3: Add `archive-confirm` style**

In `<style>`, add after `.profile-action-btn.hidden-btn`:

```css
.profile-action-btn.archive-confirm {
  color: var(--color-text);
  border-color: var(--color-border);
}
```

- [ ] **Step 4: Build the frontend and verify no type errors**

```bash
cd /Users/clement/Developer/amstramgram/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/accounts/\[username\]/+page.svelte
git commit -m "feat: add Archive button on account page with inline confirmation"
```
