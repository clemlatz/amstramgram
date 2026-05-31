# Archive Account — Design Spec

**Date:** 2026-05-31
**Branch:** feat/archive-account

## Goal

Allow archiving a complete account and all its posts in one action. The operation is irreversible (no unarchive for now).

## What "archive" means

- Account: `active=0`, `hidden=1`
- All posts of that account: `archived_at=now()`, `favorited_at=NULL` — inserted or replaced in `ratings`, for every shortcode in `media`

## Backend

### `db.py` — `archive_account(username: str, db_path: Path) -> bool`

Single transaction:
1. `UPDATE accounts SET active=0, hidden=1 WHERE username=?`
2. `INSERT OR REPLACE INTO ratings (shortcode, archived_at, favorited_at) SELECT DISTINCT shortcode, datetime('now'), NULL FROM media WHERE account_id = (SELECT id FROM accounts WHERE username=?) AND shortcode IS NOT NULL`

Returns `True` if a row was updated (account existed), `False` otherwise.

### `routes/accounts.py` — `POST /api/accounts/{username}/archive`

- Calls `archive_account(username, DB_PATH)`
- Returns 404 if account not found
- Returns `{ "archived": true }` on success

## Frontend

### `/accounts/[username]/+page.svelte`

- Add **"Archive"** button in `profile-actions`
- On click: replace button with inline **"Confirm? / Cancel"** (no modal)
- On confirm: `POST /api/accounts/{username}/archive`, then redirect to `/following`
- On cancel: restore original button state
