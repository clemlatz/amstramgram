# Feed: Remember Button in Post Header

**Date:** 2026-05-14
**Status:** Approved

## Summary

Add a small heart icon button (no label) to the right side of each post header in the feed page. Clicking it toggles the post's favorite status using the existing `rate()` API.

## Scope

Single file change: `frontend/src/lib/PostCard.svelte`.

No backend changes, no database changes, no changes to the random page.

## UI

```
┌──────────────────────────────────────────┐
│ 🟣  account_name                  [♡]   │
│     2 hours ago                          │
├──────────────────────────────────────────┤
│                  image                   │
└──────────────────────────────────────────┘
```

- Button sits as the third child of `.post-header` (flexbox row)
- `.post-meta` already has `flex: 1`, so the button naturally aligns to the right
- Button size: ~32×32px, padding 6px, transparent background, no border

## Behavior

- **Inactive:** heart outline, stroke `#8e8e8e`
- **Active (favorited):** heart filled, color `#ed4956`
- **Toggle logic:** reuses the existing `rate('favorite')` function in `PostCard.svelte`, which already handles the clear-if-already-favorited toggle via `effectiveAction`
- **Optimistic update:** state updates immediately on click; reverts on API error (already implemented in `rate()`)

## Styling

New CSS class `.header-fav-btn` (separate from the existing `.action-btn` to avoid side effects):

```css
.header-fav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}
.header-fav-btn svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: #8e8e8e;
  transition: fill 0.15s, stroke 0.15s;
}
.header-fav-btn.active svg {
  fill: #ed4956;
  stroke: #ed4956;
}
```

## Accessibility

- `aria-label="Remember"` when inactive, `aria-label="Forget"` when favorited
- `aria-pressed={favorited}` to convey toggle state

## Out of Scope

- No "Forget" / archive button in the feed
- No bottom action bar in the feed
- No changes to the random page
