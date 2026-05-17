# Audit — Amstramgram

Generated: 2026-05-17 · Last updated: 2026-05-17 · Score: **20/20** (All findings resolved)

## Checklist

### Done
- [x] **Robustness pass 1** — rate() UI lock, network vs. empty state, toLocaleTimeString, following crash, scheduler feedback, empty feed, account[0] crash, caption null, prefers-reduced-motion
- [x] **Robustness pass 2** — load functions try/catch, username[0] crash, media[0].type crash, formatDate invalid, flex overflow, caption word-break, Swiper init unguarded
- [x] **Robustness pass 3** — rel=noopener on all links, random load error → correct state, Swiper cleanup leak, media[0].url guards, nextRunAt invalid date, overflow on username/sync-label
- [x] **Accessibility pass 4** — muted text contrast (#8e8e8e → #767676), touch targets fav/mute (44px), :focus-visible global, ARIA on Following toggles, autoplay documented
- [x] **Extract pass 5** — accent tokens (favorite, forget, remember, error), Toggle component, Avatar component, media utilities (avatarColor, hideAvatarImage, formatDate)
- [x] **Optimize pass 6** — will-change: transform on tab bar
- [x] **Adapt pass 7** — sidebar nav 64px + content max-width 600px above 768px
- [x] **Polish pass 8** — hover states, hard-coded color cleanup, icon weight/roundness consistency

---

## Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 4/4 | ~~Muted text contrast~~ resolved; ~~touch targets~~ resolved; ~~focus-visible~~ added |
| 2 | Performance | 4/4 | ~~will-change missing~~ resolved; autoplay on random page confirmed intentional |
| 3 | Responsive Design | 4/4 | ~~Mobile-only~~ resolved; sidebar nav at 768px+; ~~nav button size~~ desktop-only, acceptable |
| 4 | Theming | 4/4 | ~~Accent color tokens missing~~ resolved; ~~text-muted hard-coded~~ resolved |
| 5 | Anti-Patterns | 4/4 | ~~Code duplication~~ resolved; no absolute bans violated |

**P0:** 0 · **P1:** 0 · **P2:** 0 · **P3:** 0

---

## Findings

### ✅ Resolved — Accessibility (2026-05-17, pass 4)

- **Muted text contrast** — `--color-text-muted` updated from `#8e8e8e` (3.54:1) to `#767676` (4.55:1) in light mode `:root`. `--color-tab-inactive` updated likewise. Dark mode `#a8a8a8` on `#000000` already passed (9:1). WCAG AA now met across all muted/inactive text.
- **Touch targets** — `.header-fav-btn` expanded from 32×32px to 44×44px. `.mute-btn` expanded to 44×44px hit area via transparent button + `::before` pseudo-element for the 32px visual circle — visual unchanged, tap area correct. Applied to both `PostCard.svelte` and `random/+page.svelte`.
- **`:focus-visible` global rule** — Added `:global(:focus-visible) { outline: 2px solid var(--color-text); outline-offset: 2px; }` in `+layout.svelte`. All interactive elements now show a keyboard focus ring.
- **Toggle ARIA in Following** — `<input type="checkbox" disabled>` now carries `aria-label="Active"` and `aria-describedby="account-{username}"`. The account link element has the matching `id`. Screen readers can now announce which account the toggle describes.
- **`autoplay` on random page** — Confirmed intentional: the pick/rate loop benefits from immediate video preview. Documented; no code change.

### ✅ Resolved — Performance (2026-05-17, pass 6)

- **`backdrop-filter` on tab bar without `will-change`** — Added `will-change: transform` to `.tab-bar` in `+layout.svelte` to force GPU compositing layer, preventing blur repaints on scroll.

### ✅ Resolved — Responsive Design (2026-05-17, pass 7)

- **No breakpoints for tablet/desktop** — Added sidebar nav at 768px+: `.tab-bar` becomes a 64px vertical column with `flex-direction: column`, `border-right` instead of `border-top`. `.content` gains `padding-left: 64px` and `.feed` / `.page` grow to `max-width: 600px`. Mobile layout unchanged.

### ✅ Resolved — Theming (2026-05-17, pass 5)

- **Accent colors had no CSS tokens** — Added `--color-favorite: #ed4956`, `--color-action-forget: #8b2035`, `--color-action-remember: #2d6a4f`, `--color-error: #e03131` to `:root` in `+layout.svelte`. All components updated to use tokens.
- **`.mute-btn` background** — `rgba(0,0,0,0.5)` is correct (semi-transparent black over video is readable in both light and dark mode). `var(--color-nav-btn)` was tried but reverted: it's `rgba(255,255,255,0.9)` in light mode, making the button invisible over light video.

### ✅ Resolved — Anti-Patterns (2026-05-17, pass 5 + 8)

- **Code duplication** — `AVATAR_COLORS`, `avatarColor()`, `hideAvatarImage()`, `formatDate()` were duplicated between `PostCard.svelte` and `random/+page.svelte`. Extracted to `$lib/media.js`. Avatar markup + styles extracted to `$lib/Avatar.svelte`. Toggle markup + styles extracted to `$lib/Toggle.svelte`.
- **Hard-coded colors** — `#ed4956`, `#8b2035`, `#2d6a4f`, `#e03131`, `#8e8e8e` all replaced with CSS tokens.
- **Hover states missing** — Added `@media (hover: hover) and (pointer: fine)` hover states on all interactive elements across all components.

---

## Systemic Issues

1. ~~**`#8e8e8e` in 13+ elements**~~ — Resolved: all replaced with `var(--color-text-muted)`; token value corrected to `#767676` for WCAG AA.
2. ~~**Touch targets consistently < 44px**~~ — Resolved: fav button (44×44px), mute button (44×44px via `::before`).
3. ~~**Logic duplicated between PostCard and random page**~~ — Resolved: `$lib/media.js`, `$lib/Avatar.svelte`, `$lib/Toggle.svelte` extracted. ~80 lines removed.

---

### ✅ Resolved — Robustness (2026-05-17, pass 3)

- **`rel="noopener noreferrer"` missing on all `target="_blank"` links** — `PostCard.svelte`, `random/+page.svelte`, `following/+page.svelte` all linked to Instagram without the rel attribute, exposing opener access. Fixed in all 3 locations.
- **Initial load error on random page showed "All caught up!"** — `random/+page.js` returned `{ photo: null }` on both empty queue and network failure; component initialised `fetchError = false` unconditionally. Now loader returns `loadError: true` on failure; component seeds `fetchError` from `data.loadError`. Network failures correctly surface the error/retry state.
- **`PostCard.svelte` Swiper cleanup never registered** — `onMount(async () => { ...; return cleanup })` returns a Promise to Svelte, which ignores it; the Swiper instance was never destroyed (memory leak, potential crash on unmount). Refactored to sync `onMount` + async IIFE + `return () => { cancelled = true; swiper?.destroy() }`.
- **`post.media?.length` and `post.media[0]?.url` unguarded** — Added `(post.media?.length ?? 0)` and `post.media[0]?.url`.
- **`photo.media[0].url` unguarded in random page** — Fixed with `photo.media[0]?.url`.
- **Invalid `nextRunAt` date renders "Invalid Date"** — Guard added; label only shows when `isNaN(new Date(nextRunAt).getTime())` is false.
- **Username overflow in settings** — `.account-value` now has `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
- **Sync label overflow in following header** — `.sync-label` and `.title` now protected with `max-width: 160px` + ellipsis on `.sync-label`; `min-width: 0` + ellipsis on `.title`.

### ✅ Resolved — Robustness (2026-05-17, pass 2)

- **All load functions missing `try/catch`** — All 4 `+page.js` files now wrap fetch + `res.json()` in try/catch with typed fallbacks. Data shapes are normalized (`Array.isArray`, `?? []`, `?? null`).
- **`account.username[0]` crash** — Fixed with `(account.username?.[0] ?? '')`.
- **`post.media[0].type` crash** — Added optional chaining (`media[0]?.type`).
- **`formatDate` shows "Invalid Date"** — Guard against invalid timestamps with `isNaN(date.getTime())`.
- **`.post-meta` flex overflow** — Missing `min-width: 0` on the flex child. Fixed with `overflow: hidden; text-overflow: ellipsis` on the account link.
- **Caption layout break** — `.post-caption` now has `overflow-wrap: break-word; word-break: break-word`.
- **Swiper initialization unguarded** — Both `PostCard.svelte` and `random/+page.svelte` now catch failures silently, degrading to static image display.

### ✅ Resolved — Robustness (2026-05-17, pass 1)

- **`rate()` UI lock** — `Promise.all` without `try-catch` left `loading=true/visible=false` permanently on network error. Refactored to `loadNext()` + `retryFetch()`.
- **Network error vs. empty queue** — `random` page now distinguishes the two: shows an error state with a "Try again" button instead of the misleading "All caught up!" message.
- **`toLocaleTimeString` date options ignored** — Fixed to `toLocaleString`.
- **`following/+page.js` crash on API error** — Missing `res.ok` guard before `.json()`. Fixed.
- **Scheduler toggle silent failure** — Added `schedulerError` state.
- **Empty feed state** — Added an instructive empty state.
- **`post.account[0]` crash** — Optional chaining guard added.
- **Caption `<p>` with no content** — Hidden when `post.caption` is null/undefined.
- **`prefers-reduced-motion`** — Global rule added in layout.

---

## What's Working Well

- Safe area handling: `env(safe-area-inset-bottom)` correctly applied everywhere
- ARIA on main nav: `aria-label`, `aria-pressed` on interactive elements
- Form labels: all inputs have associated `<label for="...">` elements
- Transitions: only `opacity` and `transform` — no layout thrash
- Swiper dynamic import: `await import('swiper')` in `onMount` — good code splitting
- `dvh` for empty state height: `min-height: calc(100dvh - ...)` — correct for mobile browsers
- Shared utilities: `$lib/media.js`, `$lib/Avatar.svelte`, `$lib/Toggle.svelte` — DRY and consistent
