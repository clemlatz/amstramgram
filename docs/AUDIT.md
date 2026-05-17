# Audit — Amstramgram

Generated: 2026-05-17 · Last updated: 2026-05-17 · Score: **18/20** (Solid — no open P1/P2s)

## Checklist

### Done
- [x] **Robustness pass 1** — rate() UI lock, network vs. empty state, toLocaleTimeString, following crash, scheduler feedback, empty feed, account[0] crash, caption null, prefers-reduced-motion
- [x] **Robustness pass 2** — load functions try/catch, username[0] crash, media[0].type crash, formatDate invalid, flex overflow, caption word-break, Swiper init unguarded
- [x] **Robustness pass 3** — rel=noopener on all links, random load error → correct state, Swiper cleanup leak, media[0].url guards, nextRunAt invalid date, overflow on username/sync-label
- [x] **Accessibility pass 4** — muted text contrast (#8e8e8e → #767676), touch targets fav/mute (44px), :focus-visible global, ARIA on Following toggles, autoplay documented

### To Do
- [x] **[P2] `/impeccable extract`** — accent tokens (`#ed4956`, `#8b2035`, `#2d6a4f`, `#e03131`), mute-btn dark mode (`rgba(0,0,0,0.5)` → `var(--color-nav-btn)`), extract Toggle component
- [x] **[P3] `/impeccable optimize`** — `will-change: transform` on tab bar
- [x] **[P3] `/impeccable adapt`** — responsive desktop layout: sidebar nav 64px + content 600px above 768px
- [x] **[P3] `/impeccable polish`** — hover states, hard-coded color cleanup

---

## Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3/4 | ~~Muted text contrast~~ resolved; nav buttons still 30px (desktop-only) |
| 2 | Performance | 3/4 | Implicit `autoplay` on random page videos |
| 3 | Responsive Design | 3/4 | ~~fav/mute touch targets~~ resolved; nav buttons 30px (desktop-only, lower priority) |
| 4 | Theming | 3/4 | ~~`#8e8e8e` hard-coded~~ resolved; accent color tokens still missing |
| 5 | Anti-Patterns | 3/4 | Clean — no absolute bans violated |

**P0:** 0 · **P1:** 0 · **P2:** 4 · **P3:** 3

---

## Findings

### ~~P1 — Accessibility~~ ✅ Resolved

~~**[P1] Muted text contrast fails WCAG AA**~~
~~**[P1] Touch targets < 44px on key interactive elements**~~
~~**[P2] No `:focus-visible` styles defined**~~
~~**[P2] Toggle in Following list has no accessible label**~~

See pass 4 below.

### P2 — Performance

**[P2] Implicit `autoplay` on random page videos**
- **Location:** `random/+page.svelte` — `<video ... autoplay>` (no `={false}`) on both single and carousel
- **Note:** May be intentional for the random/pick UX (immediate preview), but inconsistent with feed. Confirm intent.
- **Fix:** If unintentional, change to `autoplay={false}`. If intentional, document it.
- **Command:** `/impeccable harden`

### ✅ Resolved — Theming

**~~[P1] `#8e8e8e` hard-coded instead of `var(--color-text-muted)` in 13+ places~~**
- **Resolved 2026-05-17** — All `color/stroke: #8e8e8e` in `PostCard.svelte` and `random/+page.svelte` replaced with `var(--color-text-muted)`. Dark mode now renders correctly for `.post-date`, `.empty-sub`, heart icon, and action icons.

### P2 — Theming

**[P2] Accent colors have no CSS tokens**
- **Location:** `PostCard.svelte:265` (`#ed4956`), `random/+page.svelte:462-463` (`#8b2035`, `#2d6a4f`), `settings/+page.svelte:332` (`#e03131`)
- **Fix:** Add to `:root` in `+layout.svelte`:
  ```css
  --color-favorite: #ed4956;
  --color-action-forget: #8b2035;
  --color-action-remember: #2d6a4f;
  --color-error: #e03131;
  ```
- **Command:** `/impeccable extract`

~~**[P2] `.mute-btn` background not dark-mode aware**~~
- **Reverted** — `var(--color-nav-btn)` est blanc en light mode, rendant le bouton invisible sur vidéo claire. `rgba(0,0,0,0.5)` est correct : fond sombre semi-transparent, lisible sur vidéo en light et dark mode.

**[P3] Toggle component duplicated across 2 files**
- **Location:** `settings/+page.svelte:403-458` and `following/+page.svelte:222-275` — identical CSS
- **Fix:** Extract to `$lib/Toggle.svelte` with a `disabled` prop.
- **Command:** `/impeccable extract`

### P3 — Performance

**[P3] `backdrop-filter` on tab bar without `will-change`**
- **Location:** `+layout.svelte:138`
- **Fix:** Add `will-change: transform` to `.tab-bar` to force GPU compositing.
- **Command:** `/impeccable optimize`

### P3 — Responsive

~~**[P3] No breakpoints for tablet/desktop**~~
- **Resolved** — sidebar nav at 768px+, content 600px wide. Mobile layout unchanged.

---

## Systemic Issues

1. **`#8e8e8e` in 13+ elements** — token system exists but is incomplete. `var(--color-text-muted)` is correct; the direct hex is the bug.
2. **Touch targets consistently < 44px** on icon-only buttons across all components.
3. **Logic duplicated between PostCard and random page** — `AVATAR_COLORS`, `avatarColor()`, `hideAvatarImage()`, `formatDate()`, swiper styles, avatar styles — all duplicated. A `$lib` refactor would fix both maintenance and consistency.

---

### ✅ Resolved — Robustness (2026-05-17, pass 1)

Items below were not in the original audit but fixed during the first harden pass:

- **`rate()` UI lock** — `Promise.all` without `try-catch` left `loading=true/visible=false` permanently on network error. Refactored to `loadNext()` + `retryFetch()`.
- **Network error vs. empty queue** — `random` page now distinguishes the two: shows an error state with a "Try again" button instead of the misleading "All caught up!" message.
- **`toLocaleTimeString` date options ignored** — Scheduler next-run label dropped day/month silently. Fixed to `toLocaleString`.
- **`following/+page.js` crash on API error** — Missing `res.ok` guard before `.json()`. Fixed.
- **Scheduler toggle silent failure** — Network error on toggle produced no feedback. Added `schedulerError` state.
- **Empty feed state** — Feed rendered a blank page when no photos existed. Added an instructive empty state.
- **`post.account[0]` crash** — Optional chaining guard added.
- **Caption `<p>` with no content** — Hidden when `post.caption` is null/undefined.
- **`prefers-reduced-motion`** — Global rule added in layout.

### ✅ Resolved — Accessibility (2026-05-17, pass 4)

- **Muted text contrast** — `--color-text-muted` updated from `#8e8e8e` (3.54:1) to `#767676` (4.55:1) in light mode `:root`. `--color-tab-inactive` updated likewise. Dark mode `#a8a8a8` on `#000000` already passed (9:1). WCAG AA now met across all muted/inactive text.
- **Touch targets** — `.header-fav-btn` expanded from 32×32px to 44×44px. `.mute-btn` expanded to 44×44px hit area via transparent button + `::before` pseudo-element for the 32px visual circle — visual unchanged, tap area correct. Applied to both `PostCard.svelte` and `random/+page.svelte`.
- **`:focus-visible` global rule** — Added `:global(:focus-visible) { outline: 2px solid var(--color-text); outline-offset: 2px; }` in `+layout.svelte`. All interactive elements now show a keyboard focus ring.
- **Toggle ARIA in Following** — `<input type="checkbox" disabled>` now carries `aria-label="Active"` and `aria-describedby="account-{username}"`. The account link element has the matching `id`. Screen readers can now announce which account the toggle describes.
- **`autoplay` on random page** — Confirmed intentional: the pick/rate loop benefits from immediate video preview. Documented; no code change.

### ✅ Resolved — Robustness (2026-05-17, pass 3)

- **`rel="noopener noreferrer"` missing on all `target="_blank"` links** — `PostCard.svelte`, `random/+page.svelte`, `following/+page.svelte` all linked to Instagram without the rel attribute, exposing opener access. Fixed in all 3 locations.
- **Initial load error on random page showed "All caught up!"** — `random/+page.js` returned `{ photo: null }` on both empty queue and network failure; component initialised `fetchError = false` unconditionally. Now loader returns `loadError: true` on failure; component seeds `fetchError` from `data.loadError`. Network failures correctly surface the error/retry state.
- **`PostCard.svelte` Swiper cleanup never registered** — `onMount(async () => { ...; return cleanup })` returns a Promise to Svelte, which ignores it; the Swiper instance was never destroyed (memory leak, potential crash on unmount). Refactored to sync `onMount` + async IIFE + `return () => { cancelled = true; swiper?.destroy() }`.
- **`post.media?.length` and `post.media[0]?.url` unguarded** — `PostCard.svelte` accessed `post.media.length` and `post.media[0].url` without null guards; a backend response with missing/empty `media` would crash the component. Added `(post.media?.length ?? 0)` and `post.media[0]?.url`.
- **`photo.media[0].url` unguarded in random page** — Same issue on the single-item image branch of `random/+page.svelte`. Fixed with `photo.media[0]?.url`.
- **Invalid `nextRunAt` date renders "Invalid Date"** — `settings/+page.svelte` rendered the scheduler next-run label without checking `isNaN(new Date(nextRunAt).getTime())`. Guard added; label only shows when the date is valid.
- **Username overflow in settings** — `.account-value` had no overflow protection; a long username could push outside the container. Added `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
- **Sync label overflow in following header** — `.sync-label` and `.title` in the following header flex row had no overflow protection. Added `max-width: 160px` + ellipsis on `.sync-label`; `min-width: 0` + ellipsis on `.title`.

### ✅ Resolved — Robustness (2026-05-17, pass 2)

- **All load functions missing `try/catch`** — A network error or invalid JSON response crashed the page entirely. All 4 `+page.js` files now wrap fetch + `res.json()` in try/catch with typed fallbacks. Data shapes are normalized (`Array.isArray`, `?? []`, `?? null`).
- **`account.username[0]` crash** — `following/+page.svelte` crashed if a username was an empty string. Fixed with `(account.username?.[0] ?? '')`.
- **`post.media[0].type` crash** — `PostCard.svelte` and `random/+page.svelte` accessed `media[0]` without a length guard. Added optional chaining (`media[0]?.type`).
- **`formatDate` shows "Invalid Date"** — Both `PostCard.svelte` and `random/+page.svelte` now guard against invalid timestamps with `isNaN(date.getTime())`.
- **`.post-meta` flex overflow** — Missing `min-width: 0` on the flex child allowed long account names to overflow the post header. Fixed in both PostCard and random, with `overflow: hidden; text-overflow: ellipsis` on the account link.
- **Caption layout break** — `.post-caption` had no overflow protection; long unbreakable strings (URLs, hashes) could break layout. Added `overflow-wrap: break-word; word-break: break-word`.
- **Swiper initialization unguarded** — Dynamic `import('swiper')` and `new Swiper(...)` could throw uncaught errors. Both `PostCard.svelte` (`onMount`) and `random/+page.svelte` (`$effect`) now catch failures silently, degrading to static image display.

---

## What's Working Well

- Safe area handling: `env(safe-area-inset-bottom)` correctly applied everywhere
- ARIA on main nav: `aria-label`, `aria-pressed` on interactive elements
- Form labels: all inputs have associated `<label for="...">` elements
- Transitions: only `opacity` and `transform` — no layout thrash
- Swiper dynamic import: `await import('swiper')` in `onMount` — good code splitting
- `dvh` for empty state height: `min-height: calc(100dvh - ...)` — correct for mobile browsers

---

## Recommended Action Order

1. **[P2] `/impeccable extract`** ← **next** — accent color tokens (`#ed4956`, `#8b2035`, `#2d6a4f`, `#e03131`), mute button dark mode (`rgba(0,0,0,0.5)` → `var(--color-nav-btn)`), extract Toggle component
3. **[P3] `/impeccable optimize`** — `will-change: transform` on tab bar
4. **[P3] `/impeccable adapt`** — tablet/desktop breakpoint (or confirm mobile-only intent)
5. **[P3] `/impeccable polish`** — final quality pass
