# Account Page Design

**Date:** 2026-05-19  
**Status:** Approved

## Overview

Add individual account pages at `/accounts/[username]` — one per locally followed account. The page replicates the Instagram profile layout: large avatar header with stats and bio, followed by a 3-column post grid in reverse chronological order.

All existing account name links (PostCard, following page) are updated to point to this internal route instead of Instagram.

## Backend

### Database — new columns on `accounts`

Add three nullable columns via inline migration in `init_db` (same pattern as existing migrations):

- `bio TEXT` — account biography
- `full_name TEXT` — display name
- `external_url TEXT` — profile link

### Sync — populate during `sync-following`

The existing `_fetch_and_upsert_following` function already receives per-user objects from `api/v1/friendships/{id}/following/`. Extend it to extract `biography`, `full_name`, `external_url` from each user and pass them to `upsert_following_accounts`. Update that function to store them via `INSERT OR IGNORE ... ON CONFLICT DO UPDATE SET bio=..., full_name=..., external_url=...`.

### New DB function: `get_account_detail(username, db_path)`

Returns a single dict:

```python
{
    "username": str,
    "full_name": str | None,
    "bio": str | None,
    "external_url": str | None,
    "active": bool,
    "post_count": int,        # total media rows for this account
    "unrated_count": int,     # posts with no entry in ratings table
    "favorited_count": int,   # posts with favorited_at IS NOT NULL
    "archived_count": int,    # posts with archived_at IS NOT NULL
}
```

Unrated = shortcodes where `LEFT JOIN ratings r ON r.shortcode = m.shortcode WHERE r.shortcode IS NULL`.

### New DB function: `get_account_posts(username, db_path)`

Same structure as `get_recent_posts` but:
- Filtered to a single account by username
- No 100-post limit
- Ordered `post_timestamp DESC, carousel_index ASC`

### New API endpoints (in `routes/accounts.py`)

`GET /api/accounts/{username}` — calls `get_account_detail`, returns 404 if username not found.

`GET /api/accounts/{username}/posts` — calls `get_account_posts`, returns the same JSON shape as `/api/feed` (a `posts` array with `account`, `post_timestamp`, `shortcode`, `media`, `archived_at`, `favorited_at`, `caption`). Also returns `account_active` on each post.

## Frontend

### New route: `frontend/src/routes/accounts/[username]/`

**`+page.js`** — loads in parallel:
```js
const [profileRes, postsRes] = await Promise.all([
  fetch(`/api/accounts/${params.username}`),
  fetch(`/api/accounts/${params.username}/posts`),
]);
```
Returns `{ profile, posts }`. Gracefully returns empty state on error.

**`+page.svelte`** — two sections:

#### Header (Instagram profile style)

```
┌─────────────────────────────────────────┐
│  [Avatar 80px]  username (bold 20px)    │
│                 142 posts · 38 unrated  │
│                 21% favorited           │
│                                         │
│  Foo Bar           (full_name if set)   │
│  Bio text…         (bio if set)         │
│  🔗 example.com    (external_url if set)│
│                                         │
│  [  View on Instagram  ↗  ]             │
└─────────────────────────────────────────┘
```

- Avatar rendered via `<Avatar account={profile.username} active={profile.active} />` with size prop set to 80px (requires Avatar to accept a `size` prop, defaulting to 36px for backward compatibility)
- Stats line: `{post_count} posts · {unrated_count} unrated`
- Favorites line: `{Math.round(favorited_count / (favorited_count + archived_count) * 100)}% favorited` — only shown if `favorited_count > 0`. Matches the formula used on the `/following` page.
- full_name, bio, external_url are each conditionally rendered (omitted if null/empty)
- external_url rendered as a plain link (stripped of `https://`)
- "View on Instagram" button: `<a href="https://www.instagram.com/{username}" target="_blank" rel="noopener noreferrer">`
- No threads link, no "followed by", no stories, no filter bar

#### Post grid

3-column CSS Grid with `gap: 2px`, cells square via `aspect-ratio: 1`, `object-fit: cover`. Each cell renders `<img src={post.media[0].url} alt="" loading="lazy" />`. No click handler.

Carousel posts show a small overlay indicator (two overlapping squares icon, top-right corner) — matches Instagram's convention. Videos show no special indicator for now.

### Updates to existing components

**`PostCard.svelte`** — change account link from external Instagram URL to internal route:
```svelte
<!-- before -->
<a href="https://instagram.com/{post.account}" ...>
<!-- after -->
<a href="/accounts/{post.account}">
```

**`following/+page.svelte`** — change username link from external Instagram URL to internal route:
```svelte
<!-- before -->
<a href="https://www.instagram.com/{account.username}" ...>
<!-- after -->
<a href="/accounts/{account.username}">
```

**`Avatar.svelte`** — add optional `size` prop (default `36`), apply it to `.avatar-ring` width/height and adjust `font-size` proportionally.

**`+layout.svelte`** — update Following tab active state:
```svelte
<!-- before -->
class:active={$page.url.pathname === '/following'}
<!-- after -->
class:active={$page.url.pathname === '/following' || $page.url.pathname.startsWith('/accounts')}
```

## Error states

- Account not found (404 from API): show "Account not found" message
- Posts empty: show "No posts downloaded yet"
- Bio/full_name/external_url absent: silently omit (no placeholder)

## What's not in scope

- Clicking a grid cell (no detail view for now)
- Threads links
- "Followed by" section
- Stories
- Post filters
- Pagination (all posts loaded at once)
