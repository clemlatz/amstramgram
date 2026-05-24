# Scheduler

`scheduler.py` runs a background download loop that keeps local media in sync with followed Instagram accounts.

## Activation

The scheduler state is **persisted in the database** (`scheduler_enabled` setting). On startup, the app reads this value and automatically restarts the scheduler if it was running before the process stopped. The state is toggled via `POST /api/settings/scheduler/start` and `POST /api/settings/scheduler/stop`.

## Active time window

Every cycle begins with a check: if the current time is outside **07:00–23:00**, the scheduler sleeps until 07:00 the next morning before proceeding. This prevents Instagram activity during night hours.

## Main loop (`start_scheduler`)

```
wait initial_delay (5–30 min, log-normal, at startup)
→ wait until 07:00 if outside window
→ run cycle
→ schedule next cycle 6–9 hours later (log-normal)
→ repeat
```

On first startup, a random initial delay of **5–30 minutes** (log-normal) is applied before the first cycle. This avoids predictable startup patterns.

If the scheduler is restarted and a `next_run_at` timestamp is stored in the database, the remaining delay is restored instead of generating a new random one. If the scheduled time has already passed, the next cycle starts after a short 60-second delay.

After a successful cycle, the next run is scheduled **6–9 hours later** (log-normal) and persisted to the database as `next_run_at`. Combined with the 07:00–23:00 active window, this results in approximately **3 cycles per day**.

### Error handling in the loop

| Error type | Behaviour |
|---|---|
| `RateLimitException` | Exponential backoff: `30min × 2^(n-1)`, capped at 3 hours. After **3 consecutive** rate-limit errors, scheduler stops permanently and sends a Telegram alert. Counter resets on the next successful cycle. |
| `LoginRequiredException` / `AbortDownloadException` / `BadCredentialsException` / `TwoFactorAuthRequiredException` | Session is invalidated. Scheduler stops permanently — `INSTAGRAM_SESSION_ID` must be refreshed. Sends a Telegram alert. |
| `ConnectionException` | Network error. Flat retry after **30 minutes**. |
| Any other exception | Exponential backoff: `30min × 2^(n-1)`, capped at 3 hours. After **3 consecutive** unexpected errors, scheduler stops permanently and sends a Telegram alert. Counter resets on the next successful cycle. |

### Telegram alerts

When the scheduler stops permanently (rate limit exhausted, session invalidated, or too many consecutive errors), a Telegram alert is sent via `send_telegram_alert`.

## One cycle (`_run_cycle`)

Each cycle performs the following steps in order:

1. **DRY_RUN guard** — if `DRY_RUN=1`, the cycle is skipped entirely (no downloads, no DB writes).
2. **DB init** — creates tables if they do not exist yet.
3. **Migration** — one-time migration from the old `.done` sentinel file system (see [Legacy migration](#legacy-migration)).
4. **Authentication check** — loads the Instaloader instance; aborts if it has no username (session invalid).
5. **Session headers** — injects `X-IG-App-ID`, `Accept-Language`, `Referer`, and a mobile `User-Agent` header to mimic the Instagram iPhone app.
6. **Active accounts** — loads all accounts where `active = 1` and `instagram_user_id IS NOT NULL`.
7. **`fetch_new_posts`** — fast-updates all active accounts (recent posts first).
8. **`fetch_old_posts`** — downloads historical posts for accounts that have not yet been fully synced.
9. **Session save** — persists the (possibly refreshed) session to disk.

## Session headers

`_set_session_headers` injects the following headers on every cycle:

| Header | Value |
|---|---|
| `X-IG-App-ID` | `936619743392459` |
| `Accept-Language` | `en-US,en;q=0.9` |
| `Referer` | `https://www.instagram.com/` |
| `User-Agent` | `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/274.0.0.0` |

## Log-normal delays

All inter-account and inter-group sleeps use a **log-normal distribution** instead of a uniform random range. The helper `_lognormal_delay(low, high)` samples from a log-normal with `μ = log((low+high)/2)` and `σ = 0.4`, clamped to `[low, high]`. This produces delays that cluster around the geometric mean and have a natural long-tail shape, closer to human browsing patterns than a uniform distribution.

## `fetch_new_posts`

Targets **all active accounts** — both fully synced and unsynced.

A random subset of **15–30 accounts** is selected each cycle, shuffled, then split into groups of **15–20**:

- Within a group: **30–90 second** log-normal sleep between accounts.
- Between groups: **5–10 minute** log-normal sleep.
- Within each account (`_download_account_fast`): **2–5 second** log-normal sleep between each successfully downloaded post.

For each account, `_download_account_fast` is called:

1. Fetches the profile via the Instagram iPhone API (`/api/v1/users/{id}/info/`).
2. Checks `friendship_status.following` — if the account is no longer followed, it is deactivated and skipped.
3. Iterates the profile's posts in reverse chronological order. **Video posts are skipped** (`_post_has_video`).
4. **Fully synced accounts** (`fully_synced = 1`): stops as soon as `download_post` returns `False` (file already exists — the known frontier has been reached).
5. **Unsynced accounts** (`fully_synced = 0`): fetches at most `_MAX_RECENT_UNSYNCED` (15) posts so their latest content appears in the feed quickly, while `fetch_old_posts` handles the full historical backfill.
6. Indexes newly downloaded files (see [Indexing](#indexing)).

A **404 response** (account deleted or made private) deactivates the account (`active = 0`) and skips it. A `PrivateProfileNotFollowedException` also deactivates the account.

## `fetch_old_posts`

Targets accounts where `fully_synced = 0` (accounts that have never had a complete historical download).

- Skipped entirely if the current time is **22:00 or later** (to avoid late-night load).
- At most **3 accounts** are processed per cycle, chosen randomly from the full unsynced list.
- Per account, at most **60–140 posts** are downloaded (random, log-normal between `_MIN_DOWNLOADS_PER_ACCOUNT` and `_MAX_DOWNLOADS_PER_ACCOUNT`). **Video posts are skipped.**
- A **90–180 second** log-normal sleep is inserted between accounts.
- When an account returns **0 new downloads** in a cycle, it is marked `fully_synced = 1` — historical backfill is complete.
- Newly downloaded files are indexed after each account (see [Indexing](#indexing)).

A **404 response** deactivates the account, same as `fetch_new_posts`. A `PrivateProfileNotFollowedException` also deactivates the account.

## Indexing

After each download batch, `index_account` scans the account's storage directory:

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

## Constants

| Constant | Value | Used in |
|---|---|---|
| `_MIN_DOWNLOADS_PER_ACCOUNT` | 60 | `fetch_old_posts` — min posts downloaded per account per cycle |
| `_MAX_DOWNLOADS_PER_ACCOUNT` | 140 | `fetch_old_posts` — max posts downloaded per account per cycle |
| `_MAX_RECENT_UNSYNCED` | 15 | `fetch_new_posts` — max recent posts fetched per unsynced account |
| `_MIN_ACCOUNTS_PER_CYCLE` | 15 | `fetch_new_posts` — min accounts selected per cycle |
| `_MAX_ACCOUNTS_PER_CYCLE` | 30 | `fetch_new_posts` — max accounts selected per cycle |
| `_RATE_LIMIT_BACKOFF_BASE` | 1800 s (30 min) | Rate-limit and unexpected-error retry base; also used for `ConnectionException` |
| `_RATE_LIMIT_BACKOFF_MAX` | 10800 s (3 h) | Cap on exponential rate-limit backoff |
| `_RATE_LIMIT_MAX_RETRIES` | 3 | Max consecutive rate-limit or unexpected errors before the scheduler stops |
| Initial startup delay | 5–30 min (log-normal) | First cycle cooldown at startup |
| Inter-cycle delay | 6–9 h (log-normal) | Successful cycle cooldown (~3 cycles/day) |
| `fetch_new_posts` intra-account delay | 2–5 s (log-normal) | Between each downloaded post |
| `fetch_new_posts` inter-account delay | 30–90 s (log-normal) | Within a group |
| `fetch_new_posts` inter-group delay | 300–600 s (log-normal) | Between groups |
| `fetch_old_posts` max accounts per cycle | 3 | Catchup accounts selected per cycle |
| `fetch_old_posts` inter-account delay | 90–180 s (log-normal) | Between catchup accounts |
