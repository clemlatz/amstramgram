# Sync Following — Design Spec

**Date:** 2026-05-16  
**Status:** Approved

## Overview

Add a manual "Sync following" action that fetches the authenticated user's Instagram following list and inserts any new accounts into the local DB as active, ready to be downloaded by the scheduler.

## Backend

### Endpoint

`POST /api/accounts/sync-following`

- Returns `400` if no session is configured (`get_loader()` returns `None`).
- Uses `L.context.get_iphone_json("api/v1/friendships/{session_user_id}/following/", params)` with pagination via `next_max_id` cursor.
- The session user's numeric ID is retrieved from `L.context.get_iphone_json("api/v1/accounts/current_user/", {})`.
- For each account in the response, inserts into `accounts` using `INSERT OR IGNORE` with `active=1`, storing both `username` and `instagram_user_id`.
- Counts newly inserted rows and returns `{"added": N}`.
- Existing accounts are untouched (no deactivation, no status change).

### DB change

No schema change needed. The existing `accounts` table already has `username` (UNIQUE) and `instagram_user_id` columns. `INSERT OR IGNORE` handles duplicates gracefully.

### New DB helper

`upsert_following_accounts(accounts: list[dict], db_path: Path) -> int`  
Inserts accounts not already present, returns count of new rows.

## Frontend

In `frontend/src/routes/settings/+page.svelte`:

- Add a "Sync following" button, styled consistently with the existing settings actions.
- On click: disable button, show a loading indicator, call `POST /api/accounts/sync-following`.
- On success: display `"{N} new accounts added"` or `"Already up to date"` (if `added === 0`).
- On error: display a brief error message.
- State resets to idle after a few seconds or on next click.

## Out of scope

- Automatic daily sync (manual trigger only).
- Deactivating accounts that are no longer followed (the scheduler already handles this per-account during download).
- Background task / polling (the API call is fast enough to be synchronous).
