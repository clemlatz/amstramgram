# Post Detail Page — Design Spec

**Date:** 2026-05-24  
**Branch:** feat/post-detail-page  
**Status:** Approved

## Overview

A dedicated page for viewing a single publication from an account, using the same visual design as the random page. Accessible by clicking a post in the account grid. Supports offline browsing via localStorage cache and prev/next navigation through the account's posts.

## Route

`/accounts/[username]/[shortcode]`

Files:
- `frontend/src/routes/accounts/[username]/[shortcode]/+page.js`
- `frontend/src/routes/accounts/[username]/[shortcode]/+page.svelte`

## Data Loading (`+page.js`)

1. Read from localStorage cache `cache_account_${username}_v1` (shared with the account page).
2. If cache miss or no localStorage, fetch `GET /api/accounts/{username}/posts`.
3. Find the post matching `params.shortcode` in the posts array.
4. Return `{ post, posts, notFound }`.
   - `post`: the matched post object (with `archived_at`, `favorited_at`, `media`, etc.)
   - `posts`: the full ordered list (newest first) for prev/next navigation
   - `notFound`: true if the shortcode was not found in the list

On fetch error with no cache, return `{ post: null, posts: [], notFound: false }` (connection error state).

## Layout Changes

### `+layout.svelte` — Offline gate

The existing offline block currently excludes all pages except `/` and `/random`. Update it to also allow the post detail page by checking `$page.params.shortcode`:

```
offline.value && !isAllowedOffline($page)
```

Where `isAllowedOffline` returns true for `/`, `/random`, and any route with `$page.params.shortcode` defined.

### `accounts/[username]/+page.svelte` — Grid links

Change grid cell `<a>` elements:
- Posts with a real shortcode (not starting with `syn_`): link to `/accounts/{username}/{shortcode}`
- Posts without a real shortcode: keep `href={undefined}` (non-clickable)

Remove the `target="_blank"` and Instagram href from these cells.

## Post Detail Page (`+page.svelte`)

### Visual structure

Identical to the random page card layout:
- `post-header`: Avatar + account name + date + **back button** (top-right)
- Media: same carousel/video/image logic (Swiper for carousels, video with mute/play, image)
- Actions bar at the bottom

### Back button

Replaces the mode-chip pill in the header top-right. A `<a>` link to `/accounts/{username}` styled as a small icon button (← arrow or ✕).

### Actions bar

**Online mode:**
```
[← Prev]  [Forget]  [Remember]  [Next →]
```

**Offline mode:**
```
[← Prev]              [Next →]
```

### Rating behavior

- Initial state derived from `post.archived_at` / `post.favorited_at`.
- Local `rating` state: `'archive'` | `'favorite'` | `null`.
- `Forget` button: active (highlighted) when `rating === 'archive'`.
  - Click when inactive → call `POST /api/rate` with `action: 'archive'`, set `rating = 'archive'`.
  - Click when active → call `POST /api/rate` with `action: 'clear'`, set `rating = null`.
- `Remember` button: active (highlighted) when `rating === 'favorite'`.
  - Click when inactive → call `POST /api/rate` with `action: 'favorite'`, set `rating = 'favorite'`.
  - Click when active → call `POST /api/rate` with `action: 'clear'`, set `rating = null`.
- The post stays visible after any rating action (no navigation to next post).
- Buttons are disabled while a rating request is in flight.

### Prev / Next navigation

- `prevPost = posts[currentIndex - 1]` (newer post, towards top of grid)
- `nextPost = posts[currentIndex + 1]` (older post, towards bottom of grid)
- Navigation via SvelteKit `goto('/accounts/{username}/{shortcode}')`.
- `Prev` disabled when `currentIndex === 0`. `Next` disabled when `currentIndex === posts.length - 1`.
- If `posts` is empty or post not found, both buttons are disabled.

### Error / not found states

- `notFound: true`: show a "Post not found" empty state with a back link.
- `post: null` (connection error): show a connection error empty state.

## Files Changed

| File | Change |
|---|---|
| `frontend/src/routes/accounts/[username]/[shortcode]/+page.js` | New — load post + posts list |
| `frontend/src/routes/accounts/[username]/[shortcode]/+page.svelte` | New — post detail view |
| `frontend/src/routes/accounts/[username]/+page.svelte` | Update grid cell links |
| `frontend/src/routes/+layout.svelte` | Update offline gate to allow post detail route |
