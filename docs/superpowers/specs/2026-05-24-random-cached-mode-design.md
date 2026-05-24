# Random Page — Cached Mode

## Overview

Introduce a third mode for the Random page alongside the existing `all` and `favorites` modes. The new `cached` mode serves only posts whose media files are fully present in the Service Worker cache, enabling genuine offline browsing without relying on API calls.

## Modes

| Mode | Source | Actions | Offline-capable |
|---|---|---|---|
| `all` | `GET /api/random` | Forget, Remember | No |
| `favorites` | `GET /api/random/favorites` | Forget, Next | No |
| `cached` | localStorage + SW cache filter | Next | Yes |

## Mode Pill

The `mode-chip` pill in the post header cycles through modes on each click: `all → favorites → cached → all`. The pill label shows the current mode name ("All" / "Favorites" / "Cached"). Three visual states:

- `all`: inactive style (border, muted text)
- `favorites`: `--color-favorite` highlight (existing)
- `cached`: new `--color-cached` highlight (distinct color, e.g. teal/blue)

When offline, the pill is `disabled` and cannot cycle.

## Offline Behavior

When `offline.value` becomes `true`, the app automatically switches to `cached` mode (replacing the previous auto-switch to `favorites`). The mode pill is disabled. The mode is persisted to localStorage as `cached` so subsequent loads land in the right mode.

When returning online, the mode remains `cached` until the user changes it manually.

## loadNext — Cached Mode

1. Read `offline-favorites-posts` from localStorage (array of posts with `media[]` URLs).
2. Open the SW cache named `media-cache` via `caches.open('media-cache')`.
3. Get all cached keys, build a `Set` of cached pathnames.
4. Filter posts to those where every `media[].url` pathname is in the set.
5. Pick a random post from the filtered list.
6. If the filtered list is empty, set `fetchError = true` and show the appropriate empty state.
7. If `caches` API is unavailable (fallback), treat as empty.

This logic runs in both `loadNext()` and the `+page.js` client-side loader.

## Actions

- `all`: Forget + Remember (unchanged)
- `favorites`: Forget + Next (unchanged)
- `cached`: Next only — no rating, read-only mode

The `skip()` function is reused for the Next button in `cached` mode, same as `favorites`.

## Empty States

| Condition | Title | Subtitle | CTA |
|---|---|---|---|
| `cached`, no cached posts, online | "No cached posts" | "Cache your favorites in Settings to browse offline." | Button → `/settings` |
| `cached`, no cached posts, offline | "You're offline" | "No cached posts available." | — |
| `fetchError`, offline | "You're offline" | "No cached posts available." | — |
| `fetchError`, online | "Connection error" | "Couldn't load the next post." | Try again |

## +page.js Changes

The client-side load function reads `random-mode` from localStorage. For `cached` mode:
1. Check sessionStorage for a previously loaded post.
2. If not found, run the same cache-filter logic (localStorage posts + SW cache check).
3. Return `{ post }` or `{ post: null }` — the page component handles the empty state.

For `all` and `favorites`, behavior is unchanged.

## File Changes

- `frontend/src/routes/random/+page.svelte` — mode constants, pill, offline effect, switchMode, loadNext, actions, empty states
- `frontend/src/routes/random/+page.js` — cached mode handling in load function
- No backend changes required
