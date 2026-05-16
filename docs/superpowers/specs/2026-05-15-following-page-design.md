# Following Page — Design Spec

**Date:** 2026-05-15  
**Status:** Approved

## Overview

Add a "Following" page listing all locally tracked Instagram accounts stored in the database, inspired by Instagram's Following UI. Placed between the Random (dice) and Settings (gear) tabs in the bottom navigation.

## Backend

### New DB function: `get_all_accounts`

File: `api/db.py`

```python
def get_all_accounts(db_path: Path) -> list[dict]:
```

Query:
```sql
SELECT a.username, a.active, COUNT(m.id) AS count
FROM accounts a
LEFT JOIN media m ON m.account_id = a.id
GROUP BY a.id
ORDER BY a.username ASC
```

Returns all accounts (including those with zero media), sorted alphabetically. Each row: `username` (str), `active` (bool), `count` (int).

### New route file: `api/routes/accounts.py`

```
GET /api/accounts
```

Returns JSON array of account objects. Mounted in `api/main.py` alongside existing routes.

## Frontend

### New route: `/following`

Files:
- `frontend/src/routes/following/+page.js` — loads `/api/accounts`, returns `{ accounts }`
- `frontend/src/routes/following/+page.svelte` — renders the list

### Row layout

Each account row contains:
1. **Avatar** — circular, colored background (deterministic from username hash, same `AVATAR_COLORS` + `avatarColor()` logic as `PostCard.svelte`), first letter of username in white uppercase
2. **Text block** (two lines):
   - Line 1: username, bold, `--color-text`
   - Line 2: "{count} posts downloaded", `--color-text-muted`, smaller font
3. **Toggle switch** — right-aligned, iOS-style, `disabled`, reflects `account.active`

### Toggle

Implemented as a styled `<input type="checkbox">` with `disabled` attribute. When `active = true` → checked (green). When `active = false` → unchecked (grey). Non-interactive — no click handler.

### Navigation

`+layout.svelte` gains a 5th tab entry between `/random` and `/settings`:

```
[ feed ] [ random ] [ following ] [ settings ] [ stats ]
```

Icon: user-group (Heroicons), outline when inactive, filled when active. Same `48px` tab width, `space-around` distributes automatically.

## Constraints

- Toggle is **read-only** for now; activating/deactivating accounts is out of scope.
- No pagination needed — account lists are expected to be small (< 100).
- Avatar logic must be consistent with `PostCard.svelte` (same color palette and hash function) — duplicate inline in `+page.svelte` (YAGNI: a shared utility is not warranted for 3 usages).
