# Account Rating Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display, for each account on the Following page, the number of favorited posts and their percentage among all rated posts (favorited + archived).

**Architecture:** Extend `get_all_accounts` in `api/db.py` with two extra `COUNT(DISTINCT CASE WHEN …)` expressions joined to `ratings`. The API route already returns the full dict, so the new fields flow through automatically. The frontend `following/+page.svelte` renders the new fields as `♥ {n} ({pct}%)` below the post count, hidden when `favorited_count === 0`.

**Tech Stack:** Python 3 / SQLite (sqlite3), FastAPI, SvelteKit (Svelte 5 runes syntax), pytest.

---

## File Map

| File | Change |
|---|---|
| `api/db.py` | Modify `get_all_accounts` — richer SQL + updated return dict |
| `tests/test_account_db.py` | Add tests for the new fields |
| `frontend/src/routes/following/+page.svelte` | Render `favorited_count` / `archived_count` |

---

### Task 1: Extend `get_all_accounts` with rating counts

**Files:**
- Modify: `api/db.py` — `get_all_accounts` function (lines ~504–516)

- [ ] **Step 1: Write the failing test**

Add to `tests/test_account_db.py`:

```python
import sqlite3
from pathlib import Path
from api.db import init_db, get_all_accounts, upsert_following_accounts


def _insert_media(db: Path, account_id: int, shortcode: str) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode)"
        " VALUES (?, ?, ?, 'jpg', ?)",
        (account_id, f"{shortcode}.jpg", f"acc/{shortcode}.jpg", shortcode),
    )
    conn.commit()
    conn.close()


def _insert_rating(db: Path, shortcode: str, *, favorited: bool = False, archived: bool = False) -> None:
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO ratings (shortcode, favorited_at, archived_at) VALUES (?, ?, ?)",
        (
            shortcode,
            "2024-01-01T00:00:00" if favorited else None,
            "2024-01-01T00:00:00" if archived else None,
        ),
    )
    conn.commit()
    conn.close()


def test_get_all_accounts_includes_rating_counts(tmp_path):
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

    accounts = get_all_accounts(db)
    alice = next(a for a in accounts if a["username"] == "alice")
    assert alice["favorited_count"] == 1
    assert alice["archived_count"] == 1


def test_get_all_accounts_rating_counts_zero_when_no_ratings(tmp_path):
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "bob", "platform_user_id": "222"}], db)
    accounts = get_all_accounts(db)
    bob = next(a for a in accounts if a["username"] == "bob")
    assert bob["favorited_count"] == 0
    assert bob["archived_count"] == 0


def test_get_all_accounts_counts_distinct_shortcodes(tmp_path):
    """A carousel post (multiple media rows, same shortcode) counts as one rating."""
    db = tmp_path / "test.db"
    init_db(db)
    upsert_following_accounts([{"username": "carol", "platform_user_id": "333"}], db)
    conn = sqlite3.connect(str(db))
    account_id = conn.execute("SELECT id FROM accounts WHERE username='carol'").fetchone()[0]
    conn.close()

    # Two media rows share the same shortcode (carousel)
    _insert_media(db, account_id, "carousel1")
    conn = sqlite3.connect(str(db))
    conn.execute(
        "INSERT INTO media (account_id, filename, filepath, extension, shortcode)"
        " VALUES (?, 'carousel1_2.jpg', 'acc/carousel1_2.jpg', 'jpg', ?)",
        (account_id, "carousel1"),
    )
    conn.commit()
    conn.close()
    _insert_rating(db, "carousel1", favorited=True)

    accounts = get_all_accounts(db)
    carol = next(a for a in accounts if a["username"] == "carol")
    assert carol["favorited_count"] == 1  # not 2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_account_db.py::test_get_all_accounts_includes_rating_counts tests/test_account_db.py::test_get_all_accounts_rating_counts_zero_when_no_ratings tests/test_account_db.py::test_get_all_accounts_counts_distinct_shortcodes -v
```

Expected: FAIL — `KeyError: 'favorited_count'`

- [ ] **Step 3: Update `get_all_accounts` in `api/db.py`**

Replace the existing function:

```python
def get_all_accounts(db_path: Path) -> list[dict]:
    conn = _conn(db_path, read_only=True)
    try:
        rows = conn.execute("""
            SELECT
                a.username,
                a.active,
                COUNT(DISTINCT m.id) AS count,
                COUNT(DISTINCT CASE WHEN r.favorited_at IS NOT NULL THEN m.shortcode END) AS favorited_count,
                COUNT(DISTINCT CASE WHEN r.archived_at  IS NOT NULL THEN m.shortcode END) AS archived_count
            FROM accounts a
            LEFT JOIN media m ON m.account_id = a.id
            LEFT JOIN ratings r ON r.shortcode = m.shortcode
            GROUP BY a.id
            ORDER BY a.username ASC
        """).fetchall()
        return [
            {
                "username": r["username"],
                "active": bool(r["active"]),
                "count": r["count"],
                "favorited_count": r["favorited_count"],
                "archived_count": r["archived_count"],
            }
            for r in rows
        ]
    finally:
        conn.close()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_account_db.py::test_get_all_accounts_includes_rating_counts tests/test_account_db.py::test_get_all_accounts_rating_counts_zero_when_no_ratings tests/test_account_db.py::test_get_all_accounts_counts_distinct_shortcodes -v
```

Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
pytest tests/ -v
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add api/db.py tests/test_account_db.py
git commit -m "feat: include favorited_count and archived_count in get_all_accounts"
```

---

### Task 2: Display rating stats on the Following page

**Files:**
- Modify: `frontend/src/routes/following/+page.svelte`

- [ ] **Step 1: Add the ratings line inside the `.info` block**

In `following/+page.svelte`, locate the `.info` div (around line 51–57):

```svelte
<div class="info">
  <a class="username" ...>
    {account.username}
  </a>
  <span class="count">{account.count.toLocaleString('en')} posts</span>
</div>
```

Replace it with:

```svelte
<div class="info">
  <a class="username" id="account-{account.username}" href="https://www.instagram.com/{account.username}" target="_blank" rel="noopener noreferrer">
    {account.username}
  </a>
  <span class="count">{account.count.toLocaleString('en')} posts</span>
  {#if account.favorited_count > 0}
    {@const rated = account.favorited_count + account.archived_count}
    <span class="ratings">
      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      {account.favorited_count} ({Math.round(account.favorited_count / rated * 100)}%)
    </span>
  {/if}
</div>
```

- [ ] **Step 2: Add the `.ratings` CSS class**

In the `<style>` block, after the `.count` rule, add:

```css
.ratings {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-muted);
}
```

- [ ] **Step 3: Manual verification**

Start the dev servers:

```bash
# terminal 1
python -m api

# terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173/following`. For accounts with at least one favorited post, verify the line `♥ {n} ({pct}%)` appears below the post count. For accounts with no favorites, verify no rating line appears.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/following/+page.svelte
git commit -m "feat: show favorite count and percentage per account on Following page"
```
