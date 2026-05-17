# Audit — Amstramgram

Generated: 2026-05-17 · Last updated: 2026-05-17 · Score: **13/20** (Acceptable — work in progress)

## Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2/4 | `#8e8e8e` muted text = 3.54:1, fails WCAG AA |
| 2 | Performance | 3/4 | Implicit `autoplay` on random page videos |
| 3 | Responsive Design | 2/4 | Touch targets < 44px on fav/mute/nav buttons |
| 4 | Theming | 3/4 | ~~`#8e8e8e` hard-coded~~ resolved; accent color tokens still missing |
| 5 | Anti-Patterns | 3/4 | Clean — no absolute bans violated |

**P0:** 0 · **P1:** 2 · **P2:** 5 · **P3:** 3

---

## Findings

### P1 — Accessibility

**[P1] Muted text contrast fails WCAG AA**
- **Location:** `--color-text-muted: #8e8e8e` on `#ffffff` — ratio 3.54:1 (requires 4.5:1)
- **Affects:** `.post-date`, `.empty-sub`, stat labels, inactive tab icons, ghost button text, helper copy
- **Fix:** Update `--color-text-muted` to `#767676` minimum (4.54:1). Apply to both light `:root` and dark mode override.
- **Command:** `/impeccable harden`

**[P1] Touch targets < 44px on key interactive elements**
- **Location:**
  - `.header-fav-btn` — 32×32px (`PostCard.svelte:242`)
  - `.mute-btn` — 32×32px (`PostCard.svelte:301`, `random/+page.svelte:320`)
  - `.nav-btn` — 30×30px (`PostCard.svelte:362`)
- **Fix:** Set `width: 44px; height: 44px` on `.header-fav-btn` and `.mute-btn`. Nav buttons are desktop-only (hover:hover) so less critical.
- **WCAG:** 2.5.5 Target Size (AA)
- **Command:** `/impeccable harden`

### P2 — Accessibility

**[P2] No `:focus-visible` styles defined**
- **Location:** All components — no `:focus-visible` rule anywhere
- **Fix:** Add globally in `+layout.svelte`: `:global(:focus-visible) { outline: 2px solid var(--color-text); outline-offset: 2px; }`
- **WCAG:** 2.4.7 Focus Visible (AA)
- **Command:** `/impeccable harden`

**[P2] Toggle in Following list has no accessible label**
- **Location:** `following/+page.svelte:79` — `<input type="checkbox" checked={account.active} disabled />`
- **Fix:** Add `aria-label="Active"` and link to the account name via `aria-describedby`.
- **WCAG:** 4.1.2 Name, Role, Value (AA)
- **Command:** `/impeccable harden`

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

**[P2] `.mute-btn` background not dark-mode aware**
- **Location:** `PostCard.svelte:308`, `random/+page.svelte:321` — `background: rgba(0,0,0,0.5)`
- **Impact:** In dark mode over a dark video, the button becomes invisible.
- **Fix:** Use `var(--color-nav-btn)` (already dark-mode aware) instead of `rgba(0,0,0,0.5)`.
- **Command:** `/impeccable extract`

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

**[P3] No breakpoints for tablet/desktop**
- **Location:** All pages — `max-width: 470px` centered with no wider-viewport variant
- **Fix:** Consider a 2-column layout above 768px, or confirm mobile-only is intentional.
- **Command:** `/impeccable adapt`

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

1. **[P1] `/impeccable harden` (accessibility pass)** ← **next** — muted text contrast (`#8e8e8e` → `#767676`), touch targets (fav/mute to 44px), `:focus-visible` global rule, ARIA label on Following toggles, confirm `autoplay` intent on random videos
2. **[P2] `/impeccable extract`** — accent color tokens (`#ed4956`, `#8b2035`, `#2d6a4f`, `#e03131`), mute button dark mode (`rgba(0,0,0,0.5)` → `var(--color-nav-btn)`), extract Toggle component
3. **[P3] `/impeccable optimize`** — `will-change: transform` on tab bar
4. **[P3] `/impeccable adapt`** — tablet/desktop breakpoint (or confirm mobile-only intent)
5. **[P3] `/impeccable polish`** — final quality pass
