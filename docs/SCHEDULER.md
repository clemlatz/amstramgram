# Scheduler

`scheduler.py` runs a background download loop that keeps local media in sync with followed Instagram accounts.

## Activation

The scheduler state is **persisted in the database** (`scheduler_enabled` setting). On startup, the app reads this value and automatically restarts the scheduler if it was running before the process stopped. The state is toggled via `POST /api/settings/scheduler/start` and `POST /api/settings/scheduler/stop`.

## Active time window

Every cycle begins with a check: if the current time is outside **07:00–23:00**, the scheduler sleeps until 07:00 the next morning, plus a random **morning jitter** of 5 min – 2 h (`SYNC_MORNING_JITTER_MIN`/`MAX`) to avoid predictable daily patterns.

## Main loop (`_scheduler_loop`)

```
wait initial_delay (SYNC_INITIAL_DELAY_MIN–MAX, log-normal, at startup)
→ wait until 07:00 + jitter if outside window
→ send Telegram alert "Sync cycle starting…"
→ run cycle
→ send Telegram alert with results
→ schedule next cycle SYNC_CYCLE_DELAY_MIN–MAX later (log-normal, default 12–24 h)
→ repeat
```

On first startup, a random initial delay of **5–30 minutes** (log-normal) is applied before the first cycle. This avoids predictable startup patterns.

If the scheduler is restarted and a `next_run_at` timestamp is stored in the database, the remaining delay is restored instead of generating a new random one. If the scheduled time has already passed, the next cycle starts after a short 60-second delay.

After a successful cycle, the next run is scheduled **12–24 hours later** (log-normal, default) and persisted to the database as `next_run_at`. Combined with the 07:00–23:00 active window, this results in approximately **1–2 cycles per day**.

### Error handling in the loop

| Error type | Behaviour |
|---|---|
| `RateLimitException` | Exponential backoff: `base × 2^(n-1)`, capped at `SYNC_RATE_LIMIT_BACKOFF_MAX` (3 h). After **`SYNC_RATE_LIMIT_RETRIES`** (default 2) consecutive errors, scheduler stops permanently and sends a Telegram alert. Counter resets on the next successful cycle. |
| `LoginRequiredException` / `AbortDownloadException` / `BadCredentialsException` / `TwoFactorAuthRequiredException` / `SessionExpiredException` | Session is invalidated. Scheduler stops permanently — `INSTAGRAM_SESSION_ID` must be refreshed. Sends a Telegram alert. |
| `ConnectionException` | Network error. Flat retry after **`SYNC_RATE_LIMIT_BACKOFF_BASE`** (30 min). |
| Any other exception | Same exponential backoff as rate-limit errors. After **`SYNC_RATE_LIMIT_RETRIES`** consecutive errors, scheduler stops permanently and sends a Telegram alert. |

### Telegram alerts

Alerts are sent at every key event:
- **Cycle start** — "🔄 Sync cycle starting…"
- **Cycle success** — "✅ Sync complete — N posts downloaded" with per-account breakdown, or "nothing new"
- **Scheduler stop** — when the scheduler stops due to rate-limiting, session invalidation, or too many consecutive errors

Alerts require `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to be set. If either is missing, alerts are silently skipped.

## One cycle (`_run_cycle`)

Each cycle performs the following steps in order:

1. **DRY_RUN guard** — if `DRY_RUN=1`, the cycle is skipped entirely (no downloads, no DB writes).
2. **DB init** — creates tables if they do not exist yet.
3. **Migration** — one-time migration from the old `.done` sentinel file system (see [Legacy migration](#legacy-migration)).
4. **Authentication check** — loads the Instaloader instance; aborts if it has no username (session invalid).
5. **Session headers** — injects `X-IG-App-ID`, `Accept-Language`, `Referer`, and a `User-Agent` header (from DB setting, or the default iPhone UA).
6. **Active accounts** — loads all accounts where `active = 1` and `instagram_user_id IS NOT NULL`.
7. **`_fetch_new_posts`** — fast-updates a random subset of active accounts (recent posts first).
8. **`_fetch_old_posts`** — downloads historical posts for unsynced accounts (only if `SYNC_ENABLE_BACKFILL=true`).
9. **Session save** — persists the (possibly refreshed) session to disk.

## Session headers

`_set_session_headers` injects the following headers on every cycle:

| Header | Value |
|---|---|
| `X-IG-App-ID` | `936619743392459` |
| `Accept-Language` | `en-US,en;q=0.9` |
| `Referer` | `https://www.instagram.com/` |
| `User-Agent` | DB setting `user_agent`, or default iPhone UA if not set |

The default User-Agent is `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/274.0.0.0`.

## Log-normal delays

All delays use a **log-normal distribution** instead of a uniform random range. The helper `_lognormal_delay(low, high)` samples from a log-normal with `μ = log((low+high)/2)` and `σ = 0.4`, clamped to `[low, high]`. This produces delays that cluster around the geometric mean with a natural long-tail shape, closer to human browsing patterns than a uniform distribution.

## `_fetch_new_posts`

Targets **all active accounts** — both fully synced and unsynced.

A random subset of **`SYNC_ACCOUNTS_PER_CYCLE_MIN`–`SYNC_ACCOUNTS_PER_CYCLE_MAX`** accounts (default 5–10) is selected each cycle, shuffled, then split into groups of **15–20**:

- Within a group: **`SYNC_ACCOUNT_DELAY_MIN`–`SYNC_ACCOUNT_DELAY_MAX`** (default 60–180 s) log-normal sleep between accounts.
- Between groups: **`SYNC_GROUP_DELAY_MIN`–`SYNC_GROUP_DELAY_MAX`** (default 600–1200 s) log-normal sleep.
- Within each account (`_sync_account_fast`): **`SYNC_POST_DELAY_MIN`–`SYNC_POST_DELAY_MAX`** (default 10–30 s) log-normal sleep between each successfully downloaded post.

For each account, `_sync_account_fast` is called:

1. Fetches the profile via the Instagram iPhone API (`/api/v1/users/{id}/info/`).
2. Checks `friendship_status.following` — if the account is no longer followed, it is deactivated and skipped.
3. Iterates the profile's posts in reverse chronological order. **Video posts are skipped** (`_post_has_video`).
4. **Fully synced accounts** (`fully_synced = 1`): stops as soon as `download_post` returns `False` (file already exists — the known frontier has been reached).
5. **Unsynced accounts** (`fully_synced = 0`): fetches at most `SYNC_MAX_RECENT_POSTS` (default 5) posts so their latest content appears in the feed quickly, while `_fetch_old_posts` handles the full historical backfill.
6. Indexes newly downloaded files (see [Indexing](#indexing)).

A **404 response** or a stale GraphQL query error deactivates or skips the account respectively. A `PrivateProfileNotFollowedException` also deactivates the account.

## `_fetch_old_posts`

**Disabled by default** — only runs when `SYNC_ENABLE_BACKFILL=true`.

Targets accounts where `fully_synced = 0` (accounts that have never had a complete historical download).

- At most **3 accounts** are processed per cycle, chosen randomly from the full unsynced list.
- Per account, at most **`SYNC_BACKFILL_MIN`–`SYNC_BACKFILL_MAX`** posts (default 30–60) are downloaded. **Video posts are skipped.**
- A **`SYNC_BACKFILL_DELAY_MIN`–`SYNC_BACKFILL_DELAY_MAX`** (default 180–360 s) log-normal sleep is inserted between accounts.
- When an account returns **0 new downloads** in a cycle, it is marked `fully_synced = 1` — historical backfill is complete.
- Newly downloaded files are indexed after each account (see [Indexing](#indexing)).

A **404 response** deactivates the account, same as `_fetch_new_posts`. A `PrivateProfileNotFollowedException` also deactivates the account.

## Indexing

After each download batch, `index_account` scans the account's storage directory (`STORAGE_BASE/media/{platform_user_id}/`):

1. Lists all media files (`.jpg`, `.jpeg`, `.webp`, `.png`, `.mp4`).
2. Compares against filepaths already recorded in the `media` table — only new files are processed.
3. For each new file, reads the accompanying JSON sidecar (`.json` or `.json.xz`) to extract metadata: `shortcode`, `post_type`, `caption`, `like_count`, `comment_count`, `location`.
4. Parses the filename stem to extract `post_timestamp` and `carousel_index`.
5. Reads image dimensions via Pillow (best-effort; skipped on error).
6. Bulk-inserts all new rows into `media` with `INSERT OR IGNORE`.
7. Deletes all consumed JSON sidecar files.

## Legacy migration

On the first cycle after upgrading from an older version of the stack, `migrate_done_files` runs:

- Adds the `fully_synced` column to the `accounts` table if it is missing.
- For every active account whose storage directory contains a `.done` sentinel file, sets `fully_synced = 1` and deletes the `.done` file.

This is a no-op once all accounts have been migrated.

## Constants and tuning

All values below are configurable via environment variables (see `config.py`). Defaults are intentionally conservative to minimize Instagram API traffic.

| Env var | Default | Used in |
|---|---|---|
| `SYNC_ACCOUNTS_PER_CYCLE_MIN` | 5 | `_fetch_new_posts` — min accounts per cycle |
| `SYNC_ACCOUNTS_PER_CYCLE_MAX` | 10 | `_fetch_new_posts` — max accounts per cycle |
| `SYNC_MAX_RECENT_POSTS` | 5 | `_fetch_new_posts` — max recent posts per unsynced account |
| `SYNC_BACKFILL_MIN` | 30 | `_fetch_old_posts` — min posts per account per cycle |
| `SYNC_BACKFILL_MAX` | 60 | `_fetch_old_posts` — max posts per account per cycle |
| `SYNC_POST_DELAY_MIN` | 10 s | `_sync_account_fast` — min delay between posts |
| `SYNC_POST_DELAY_MAX` | 30 s | `_sync_account_fast` — max delay between posts |
| `SYNC_ACCOUNT_DELAY_MIN` | 60 s | `_fetch_new_posts` — min delay between accounts (intra-group) |
| `SYNC_ACCOUNT_DELAY_MAX` | 180 s | `_fetch_new_posts` — max delay between accounts (intra-group) |
| `SYNC_GROUP_DELAY_MIN` | 600 s | `_fetch_new_posts` — min delay between groups |
| `SYNC_GROUP_DELAY_MAX` | 1200 s | `_fetch_new_posts` — max delay between groups |
| `SYNC_BACKFILL_DELAY_MIN` | 180 s | `_fetch_old_posts` — min delay between accounts |
| `SYNC_BACKFILL_DELAY_MAX` | 360 s | `_fetch_old_posts` — max delay between accounts |
| `SYNC_CYCLE_DELAY_MIN` | 43200 s (12 h) | Main loop — min inter-cycle delay |
| `SYNC_CYCLE_DELAY_MAX` | 86400 s (24 h) | Main loop — max inter-cycle delay |
| `SYNC_INITIAL_DELAY_MIN` | 300 s (5 min) | Main loop — min initial startup delay |
| `SYNC_INITIAL_DELAY_MAX` | 1800 s (30 min) | Main loop — max initial startup delay |
| `SYNC_MORNING_JITTER_MIN` | 300 s (5 min) | `_wait_until_window` — min jitter after 07:00 |
| `SYNC_MORNING_JITTER_MAX` | 7200 s (2 h) | `_wait_until_window` — max jitter after 07:00 |
| `SYNC_ENABLE_BACKFILL` | `false` | Enable `_fetch_old_posts` |
| `SYNC_RATE_LIMIT_RETRIES` | 2 | Max consecutive errors before stopping |
| `SYNC_RATE_LIMIT_BACKOFF_BASE` | 1800 s (30 min) | Base for exponential backoff; also flat retry for `ConnectionException` |
| `SYNC_RATE_LIMIT_BACKOFF_MAX` | 10800 s (3 h) | Cap on exponential backoff |
