# Account Rating Stats — Design

**Date:** 2026-05-17
**Status:** Approved

## Goal

Display, for each account on the Following page, the number of favorited posts and their percentage among all rated posts (favorited + archived).

## Data Model

No schema change. The existing tables provide everything needed:

- `media.account_id` → links posts to accounts
- `ratings.shortcode` → `favorited_at` / `archived_at`

**Definitions:**
- `favorited_count` = distinct shortcodes with `favorited_at IS NOT NULL` for that account
- `archived_count` = distinct shortcodes with `archived_at IS NOT NULL` for that account
- `rated` = `favorited_count + archived_count` (denominator for the percentage)
- Percentage = `round(favorited_count / rated * 100)`

## Backend

### `api/db.py` — `get_all_accounts`

Extend the existing SQL query with two additional `COUNT(DISTINCT CASE WHEN ...)` expressions joined via `ratings`:

```sql
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
```

The return type gains two new integer fields:

```python
{"username": str, "active": bool, "count": int, "favorited_count": int, "archived_count": int}
```

No new route or endpoint needed.

## Frontend

### `frontend/src/routes/following/+page.svelte`

Add a `ratings` line inside the `.info` block, below the existing `.count` span.

Visibility rule: only render if `favorited_count > 0`.

Format: `♥ {favorited_count} ({pct}%)`
- Heart: same SVG path as `PostCard.svelte` (`fill="currentColor"`, 12×12px)
- `pct = Math.round(favorited_count / (favorited_count + archived_count) * 100)`
- Style: `font-size: 13px`, `color: var(--color-text-muted)` — matches the existing `.count` line

Example render:

```
[avatar]  username
          1,234 posts
          ♥ 46 (51%)          [toggle]
```

## Out of Scope

- No change to `/api/stats` or any other route
- No display of archived percentage
- No sorting or filtering by rating stats
