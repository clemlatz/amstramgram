# Cache All Favorites — Design

## Overview

Add a settings button that pre-populates the service worker media cache with all favorited posts, enabling full offline access to favorites. A progress bar tracks the operation.

## Backend

**New DB function** in `api/db.py`:
```python
def get_all_favorite_media_filepaths(db_path: Path) -> list[str]
```
Returns all `filepath` values from `media` joined with `ratings` where `favorited_at IS NOT NULL`, filtered to media extensions.

**New API endpoint** added to `api/routes/random.py`:
```
GET /api/favorites/media-urls
→ { "urls": ["/api/media/<encoded>", ...], "total": N }
```
Uses `_encode` and `_media_type` already in scope.

## Frontend

**New section in `frontend/src/routes/settings/+page.svelte`:**

Label: "Offline favorites"
Sub-label: "Download all favorites for offline use"

States:
- `caching: boolean` — operation in progress
- `cacheTotal: number | null` — total URL count
- `cacheDone: number` — fetched count
- `cacheDoneMsg: string | null` — completion message

Logic (in `cacheAllFavorites()`):
1. Fetch `GET /api/favorites/media-urls`
2. Set `cacheTotal` and iterate URLs in batches of 3 using `Promise.allSettled`
3. Increment `cacheDone` after each batch
4. On completion: set `cacheDoneMsg = "Done — N files cached"`

UI:
- Button disabled while `caching`
- `<progress>` element visible when `caching || cacheDoneMsg`
- Completion/error message below progress

## Constraints

- Workbox handles cache eviction (maxEntries: 500) — no changes to `sw.js`
- Fetches are fire-and-forget per batch; partial failures are silently swallowed (SW still caches successful ones)
- Operation is interruptible by closing the page (acceptable for a manual action)
