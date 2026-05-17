# Favorites Random Mode — Design Spec

**Date:** 2026-05-17
**Status:** Approved

## Summary

Add a mode toggle to the `/random` page that lets users browse only their favorited posts in random order, instead of unrated posts. The selected mode persists across sessions via `localStorage`.

## Requirements

- Users can switch between "All" (current behavior: unrated posts) and "Favorites" (favorited posts) on the `/random` page.
- The toggle state is persisted in `localStorage` and restored on page load.
- In **All** mode: behavior is unchanged — Forget / Remember buttons.
- In **Favorites** mode:
  - Posts shown have `favorited_at IS NOT NULL`.
  - Buttons: **Forget** (archives the post, removing it from favorites) and **Next** (skips without any rating action).
  - Switching the toggle immediately loads a post in the new mode.
- Equal-weight-per-account selection logic applies in favorites mode (same as All mode).

## Backend Changes

### `api/db.py`

New function `get_random_favorite_post(db_path: Path) -> dict | None`:
- Same structure as `get_random_neutral_post`.
- First query: pick a random account that has at least one favorited post.
- Second query: pick a random shortcode from that account where `r.favorited_at IS NOT NULL`.
- Third query: fetch all media rows for that shortcode.
- Returns the same dict shape as `get_random_neutral_post`.

### `api/routes/random.py`

New handler `GET /api/random/favorites`:
- Calls `get_random_favorite_post`.
- Returns the same JSON shape as `GET /api/random`: `{ "post": { account, post_timestamp, shortcode, media[] } | null }`.

The new route must be registered in `api/main.py` (or wherever routers are mounted).

## Frontend Changes

### `frontend/src/routes/random/+page.svelte`

**Toggle UI:**
- Segmented control with two options: "All" and "Favorites", rendered above the post card.
- Reads initial mode from `localStorage` key `random-mode` on mount (defaults to `"all"`).
- Writes to `localStorage` on every toggle switch.

**Mode-aware fetch:**
- `loadNext()` calls `/api/random/favorites` when mode is `"favorites"`, `/api/random` otherwise.
- Switching mode calls `loadNext()` immediately so a relevant post appears right away.

**Action buttons — favorites mode:**
- **Forget**: calls `POST /api/rate` with `action: "archive"`, then `loadNext()`.
- **Next**: calls `loadNext()` without any rating.
- The Remember button is hidden in favorites mode.

**Empty state — favorites mode:**
- Title: "No favorites yet"
- Sub: "Posts you remember will appear here."

## Out of Scope

- No changes to the feed page or other routes.
- No server-side persistence of the mode preference (localStorage only).
- No pagination or bulk actions on favorites.
