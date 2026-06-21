# Profile Grid — Downloaded Post Overlay

**Date:** 2026-06-21  
**Status:** Approved

## Goal

On Instagram profile pages, visually mark posts that have already been downloaded (present in the local download history).

## Scope

- **Where:** Profile pages only (`getCurrentProfileUsername()` returns a non-empty string).
- **Not active on:** feed, explore, reels, DMs, stories, or any non-profile path.
- **Data source:** Local `downloadHistorySet` only (no Amstramgram API call).
- **Activation:** Always-on — no user toggle required.

## Architecture

A new function `observeProfileGrid()` is added in `main.js`, called:
1. At script initialisation (for the current page).
2. After each SPA navigation (from the existing `pushState`/`replaceState` hook).

### Start / stop logic

- On navigation, if `getCurrentProfileUsername()` is non-empty → **start** a `MutationObserver` on `<main>` (fallback: `document.body`).
- Before starting, clean up any previous observer and remove all existing overlay/badge elements injected in the previous run (`querySelectorAll("[data-ig-hd-downloaded]")`).
- On navigation to a non-profile page → **stop** the observer, clear `seenLinks`.

### Mutation handler

For each `MutationRecord`:
1. Walk all added nodes (and their subtrees) to collect `<a href>` elements matching `/p/` or `/reel/`.
2. Skip links already in `seenLinks`.
3. Add to `seenLinks`.
4. Extract shortcode via `extractInstagramPostShortcodeFromHref(href)`.
5. Call `hasDownloadedHistoryKey("shortcode:" + shortcode)`.
6. If true → inject overlay + badge (see Rendering).

An **initial scan** runs immediately on start (same logic, over `main.querySelectorAll(...)`) to mark posts already in the DOM before the observer fires.

### Performance

- `seenLinks` (a `Set`) prevents re-processing links across mutations. Each `<a>` is touched at most once per profile session.
- No timer, no debounce — cost is O(newly added nodes).

## Rendering

### CSS additions (in the existing CSS block at top of `main.js`)

```css
/* Profile grid — downloaded markers */
a[data-ig-hd-downloaded] {
  position: relative;
}
.ig-hd-grid-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
  z-index: 1;
}
.ig-hd-grid-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
}
.ig-hd-grid-badge svg {
  width: 12px;
  height: 12px;
  stroke: #fff;
  fill: none;
}

/* Light theme overrides */
[data-ig-hd-theme="light"] .ig-hd-grid-overlay {
  background: rgba(0, 0, 0, 0.25);
}
[data-ig-hd-theme="light"] .ig-hd-grid-badge {
  background: rgba(255, 255, 255, 0.7);
}
[data-ig-hd-theme="light"] .ig-hd-grid-badge svg {
  stroke: #333;
}
```

### DOM injection per marked link

```html
<a href="/p/SHORTCODE/" data-ig-hd-downloaded="1">
  <!-- existing Instagram content -->
  <div class="ig-hd-grid-overlay"></div>
  <div class="ig-hd-grid-badge">
    <svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </div>
</a>
```

`position: relative` is ensured via the `a[data-ig-hd-downloaded]` CSS selector — no inline style needed.

## Edge Cases

| Scenario | Behaviour |
|---|---|
| User downloads a post while on the profile page | New shortcode enters `downloadHistorySet`, but `seenLinks` already contains that `<a>` → not retroactively marked. Acceptable — refreshing the page corrects it. |
| Scroll infinite loads more posts | `MutationObserver` captures new `<a>` elements automatically. |
| Navigation back to same profile | Previous observer stopped, previous overlays removed, fresh scan starts. |
| Profile page loads slowly (deferred grid) | Initial scan at start + observer on subsequent mutations covers both cases. |
| Non-profile page (explore, reels…) | `getCurrentProfileUsername()` returns `""` → observer not started. |

## Files Changed

- `userscript/src/main.js` — CSS additions + `observeProfileGrid()` function + wiring into SPA navigation hook and init.
