# Profile Picture Download — Design Spec

**Date:** 2026-05-16

## Goal

Download the Instagram profile picture for each account when it is first added via sync-following, store it on disk, and display it in the Following page in place of the generated letter circle.

## Data layer

- Add a nullable `profile_pic_path TEXT` column to the `accounts` table.
- Migration: `ALTER TABLE accounts ADD COLUMN profile_pic_path TEXT` inside `init_db` (guarded by a `PRAGMA table_info` check, matching the existing pattern in `migrate_done_files`).
- New DB function `save_account_profile_pic(instagram_user_id: str, path: str, db_path: Path)` — `UPDATE accounts SET profile_pic_path = ? WHERE instagram_user_id = ?`. Path is stored relative to `STORAGE_BASE` (e.g. `{instagram_user_id}/profile.jpg`), matching the convention used for `media.filepath`.
- New DB function `get_account_profile_pic_path(username: str, db_path: Path) -> str | None` — returns the stored `profile_pic_path` for the avatar route.
- `get_all_accounts` unchanged — the frontend derives the avatar URL from the username it already receives.

## Background download flow

1. `_fetch_and_upsert_following` (in `api/routes/accounts.py`) already has each user's `profile_pic_url` from the Instagram API response. Include it in the `accounts` list passed to `upsert_following_accounts`.
2. After the upsert, query the DB for accounts in that list whose `profile_pic_path IS NULL` (covers new accounts and any whose previous download failed).
3. From the async route handler, fire `asyncio.create_task(_download_profile_pics_bg(candidates, L))` — non-blocking, the sync response returns immediately.
4. `_download_profile_pics_bg` (in `api/routes/accounts.py`):
   - Loops over candidates in sequence.
   - Downloads `profile_pic_url` via `L.context._session.get(url)` (reuses the authenticated CDN session).
   - Saves to `STORAGE_BASE / instagram_user_id / "profile.jpg"`.
   - Calls `save_account_profile_pic(instagram_user_id, f"{instagram_user_id}/profile.jpg", DB_PATH)`.
   - Sleeps 1–2 s between downloads to avoid appearing bot-like.
   - Logs `"profile_pic: downloading for {username}"` before each download and `"profile_pic: saved for {username}"` on success.
   - Errors are logged and skipped — a failed pic does not affect the sync result.
5. Profile pictures are downloaded **once only**. Accounts already in the DB with a non-null `profile_pic_path` are excluded from the download candidates.

## API route

- New route `GET /api/accounts/{username}/avatar` in `api/routes/accounts.py`.
- Looks up `profile_pic_path` for the username.
- Returns the file as `image/jpeg` using FastAPI's `FileResponse`.
- Returns 404 if the account is unknown or the picture has not been downloaded yet.

## Frontend

- In `frontend/src/routes/following/+page.svelte`, each list row shows:
  - An `<img>` with `src="/api/accounts/{account.username}/avatar"`.
  - An `onerror` handler that hides the `<img>` and shows the existing letter-circle fallback.
  - The letter-circle is kept in the DOM but hidden by default when the image loads successfully.
- No change to the `/api/accounts` response shape.

## Error handling

| Scenario | Behaviour |
|---|---|
| Profile pic URL missing in API response | Skip silently, log warning |
| CDN download fails (network, 4xx, 5xx) | Log error, skip — pic stays null, fallback shown |
| File write fails | Log error, skip — DB not updated |
| Avatar route called before pic is ready | 404 → frontend shows letter circle |

## Out of scope

- Refreshing profile pictures after the initial download.
- Profile pictures on any page other than Following.
