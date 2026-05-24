# Random Page — Cached Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third `cached` mode to the Random page that serves only posts whose media files are fully present in the Service Worker cache, with automatic switch to `cached` when offline.

**Architecture:** All changes are frontend-only (two files). The mode pill cycles `all → favorites → cached → all`. The `cached` mode reads from `offline-favorites-posts` in localStorage (populated by "Cache all favorites" in Settings), filters to posts whose media URLs are in the `media-cache` SW cache, and picks randomly. No API calls are made in `cached` mode.

**Tech Stack:** SvelteKit (adapter-static), Svelte 5 runes, Workbox (CacheFirst SW cache named `media-cache`)

---

### Task 1: Update `+page.js` — handle `cached` mode in the client-side loader

**Files:**
- Modify: `frontend/src/routes/random/+page.js`

The load function currently handles `all` and `favorites`. Add a `cached` branch that reads `offline-favorites-posts` from localStorage, filters by SW cache presence, and returns a random post.

- [ ] **Step 1: Replace `+page.js` with the updated version**

```js
const MODE_KEY = 'random-mode';

async function pickCachedPost() {
  const stored =
    typeof localStorage !== 'undefined' ? localStorage.getItem('offline-favorites-posts') : null;
  if (!stored) return null;
  let posts;
  try {
    posts = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!posts.length) return null;
  let available = posts;
  if ('caches' in window) {
    const cache = await caches.open('media-cache');
    const keys = await cache.keys();
    const cachedPaths = new Set(keys.map((r) => new URL(r.url).pathname));
    available = posts.filter((p) => p.media.every((m) => cachedPaths.has(m.url)));
  }
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export async function load({ fetch }) {
  const mode =
    (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)) || 'all';
  const storageKey = `random_post_${mode}`;

  if (typeof sessionStorage !== 'undefined') {
    const cached = sessionStorage.getItem(storageKey);
    if (cached) {
      try {
        return { post: JSON.parse(cached) };
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }
  }

  if (mode === 'cached') {
    try {
      const post = await pickCachedPost();
      if (post && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(storageKey, JSON.stringify(post));
      }
      return { post: post ?? null };
    } catch {
      return { post: null, loadError: true };
    }
  }

  try {
    const endpoint = mode === 'favorites' ? '/api/random/favorites' : '/api/random';
    const res = await fetch(endpoint);
    if (!res.ok) return { post: null, loadError: true };
    const { post } = await res.json();
    if (post && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(storageKey, JSON.stringify(post));
    }
    return { post: post ?? null };
  } catch {
    return { post: null, loadError: true };
  }
}
```

- [ ] **Step 2: Verify the dev server starts without errors**

```bash
cd frontend && npm run dev 2>&1 | head -20
```

Expected: server starts, no import errors.

---

### Task 2: Add mode constants and update `switchMode` + pill in `+page.svelte`

**Files:**
- Modify: `frontend/src/routes/random/+page.svelte` (script section, header pill)

- [ ] **Step 1: Replace the constants and `switchMode` function in the script block**

Find and replace the top of the script (constants and `switchMode`). The `MODE_KEY` and `cacheKey` remain unchanged. Add `MODES` and `MODE_LABELS`, and rewrite `switchMode` to cycle instead of accepting a target mode argument.

Replace this block:
```js
const MODE_KEY = 'random-mode';
const cacheKey = (m) => `random_post_${m}`;
```

With:
```js
const MODE_KEY = 'random-mode';
const cacheKey = (m) => `random_post_${m}`;
const MODES = ['all', 'favorites', 'cached'];
const MODE_LABELS = { all: 'All', favorites: 'Favorites', cached: 'Cached' };
```

Replace the `switchMode` function:
```js
async function switchMode(newMode) {
  if (newMode === mode) return;
  if (offline.value && newMode !== 'favorites') return;

  if (post && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(cacheKey(mode), JSON.stringify(post));
  }

  mode = newMode;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MODE_KEY, mode);
  }

  if (typeof sessionStorage !== 'undefined') {
    const cached = sessionStorage.getItem(cacheKey(mode));
    if (cached) {
      try {
        post = JSON.parse(cached);
        return;
      } catch {
        sessionStorage.removeItem(cacheKey(mode));
      }
    }
  }

  post = null;
  loading = true;
  await loadNext();
}
```

With:
```js
async function switchMode() {
  if (offline.value) return;

  if (post && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(cacheKey(mode), JSON.stringify(post));
  }

  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MODE_KEY, mode);
  }

  if (typeof sessionStorage !== 'undefined') {
    const cached = sessionStorage.getItem(cacheKey(mode));
    if (cached) {
      try {
        post = JSON.parse(cached);
        return;
      } catch {
        sessionStorage.removeItem(cacheKey(mode));
      }
    }
  }

  post = null;
  loading = true;
  await loadNext();
}
```

- [ ] **Step 2: Update the mode pill button in the template**

Replace:
```svelte
<button
  class="mode-chip"
  class:active={mode === 'favorites'}
  disabled={offline.value}
  onclick={() => switchMode(mode === 'favorites' ? 'all' : 'favorites')}
  aria-label={mode === 'favorites' ? 'Switch to all posts' : 'Switch to favorites'}
  >Favorites</button
>
```

With:
```svelte
<button
  class="mode-chip"
  class:favorites={mode === 'favorites'}
  class:cached={mode === 'cached'}
  disabled={offline.value}
  onclick={switchMode}
  aria-label="Switch mode"
  >{MODE_LABELS[mode]}</button
>
```

- [ ] **Step 3: Verify the pill renders without errors**

Open the random page in the browser. The pill should show "All" when in default mode. Clicking it should cycle through All → Favorites → Cached → All.

---

### Task 3: Update the offline `$effect` to switch to `cached` instead of `favorites`

**Files:**
- Modify: `frontend/src/routes/random/+page.svelte` (script section)

- [ ] **Step 1: Replace the offline effect**

Replace:
```js
$effect(() => {
  if (!offline.value) return;
  untrack(() => {
    if (mode === 'favorites') return;
    if (post && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(cacheKey(mode), JSON.stringify(post));
    }
    mode = 'favorites';
    if (typeof localStorage !== 'undefined') localStorage.setItem(MODE_KEY, 'favorites');
    const cached =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(cacheKey('favorites'))
        : null;
    if (cached) {
      try {
        post = JSON.parse(cached);
        fetchError = false;
      } catch {
        if (typeof sessionStorage !== 'undefined')
          sessionStorage.removeItem(cacheKey('favorites'));
      }
    } else {
      loadNext();
    }
  });
});
```

With:
```js
$effect(() => {
  if (!offline.value) return;
  untrack(() => {
    if (mode === 'cached') return;
    if (post && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(cacheKey(mode), JSON.stringify(post));
    }
    mode = 'cached';
    if (typeof localStorage !== 'undefined') localStorage.setItem(MODE_KEY, 'cached');
    const cached =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(cacheKey('cached'))
        : null;
    if (cached) {
      try {
        post = JSON.parse(cached);
        fetchError = false;
      } catch {
        if (typeof sessionStorage !== 'undefined')
          sessionStorage.removeItem(cacheKey('cached'));
      }
    } else {
      loadNext();
    }
  });
});
```

---

### Task 4: Implement `loadNext` for `cached` mode; remove stale offline-favorites branch

**Files:**
- Modify: `frontend/src/routes/random/+page.svelte` (script section)

- [ ] **Step 1: Replace the `loadNext` function**

The current function has a special `if (offline.value && mode === 'favorites')` branch that reads from localStorage. With the new design, offline always means `cached` mode, so that branch is dead code. Replace the entire function:

```js
async function loadNext() {
  if (mode === 'cached') {
    try {
      const stored =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('offline-favorites-posts')
          : null;
      if (stored) {
        const posts = JSON.parse(stored);
        let available = posts;
        if ('caches' in window) {
          const cache = await caches.open('media-cache');
          const keys = await cache.keys();
          const cachedPaths = new Set(keys.map((r) => new URL(r.url).pathname));
          available = posts.filter((p) => p.media.every((m) => cachedPaths.has(m.url)));
        }
        if (available.length > 0) {
          const next = available[Math.floor(Math.random() * available.length)];
          post = next;
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(cacheKey('cached'), JSON.stringify(next));
          }
          fetchError = false;
          visible = true;
          loading = false;
          return;
        }
      }
    } catch {
      // fall through to error state
    }
    post = null;
    fetchError = true;
    visible = true;
    loading = false;
    return;
  }

  try {
    const endpoint = mode === 'favorites' ? '/api/random/favorites' : '/api/random';
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error();
    const { post: next } = await res.json();
    post = next;
    if (typeof sessionStorage !== 'undefined') {
      if (next) sessionStorage.setItem(cacheKey(mode), JSON.stringify(next));
      else sessionStorage.removeItem(cacheKey(mode));
    }
  } catch {
    post = null;
    fetchError = true;
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(cacheKey(mode));
  }
  visible = true;
  loading = false;
}
```

- [ ] **Step 2: Verify in browser**

Navigate to random page in `cached` mode (set `localStorage.setItem('random-mode', 'cached')` in devtools console, reload). With no cached posts, should show error/empty state. No JS errors in console.

---

### Task 5: Update actions — Next only for `cached` mode

**Files:**
- Modify: `frontend/src/routes/random/+page.svelte` (template)

- [ ] **Step 1: Replace the actions block**

Replace:
```svelte
<div class="actions">
  {#if mode === 'favorites'}
    <button
      class="btn forget"
      disabled={loading || offline.value}
      onclick={() => rate('archive')}
    >
      <svg ...>...</svg>
      Forget
    </button>
    <button class="btn next" disabled={loading || offline.value} onclick={skip}>
      <svg ...>...</svg>
      Next
    </button>
  {:else}
    <button
      class="btn forget"
      disabled={loading || offline.value}
      onclick={() => rate('archive')}
    >
      <svg ...>...</svg>
      Forget
    </button>
    <button
      class="btn remember"
      disabled={loading || offline.value}
      onclick={() => rate('favorite')}
    >
      <svg ...>...</svg>
      Remember
    </button>
  {/if}
</div>
```

With (preserve the exact SVG markup from the original; shown here as `...SVG...` for brevity — copy them from the current file):

```svelte
<div class="actions">
  {#if mode === 'cached'}
    <button class="btn next" disabled={loading} onclick={skip}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      Next
    </button>
  {:else if mode === 'favorites'}
    <button
      class="btn forget"
      disabled={loading || offline.value}
      onclick={() => rate('archive')}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      Forget
    </button>
    <button class="btn next" disabled={loading || offline.value} onclick={skip}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      Next
    </button>
  {:else}
    <button
      class="btn forget"
      disabled={loading || offline.value}
      onclick={() => rate('archive')}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      Forget
    </button>
    <button
      class="btn remember"
      disabled={loading || offline.value}
      onclick={() => rate('favorite')}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        />
      </svg>
      Remember
    </button>
  {/if}
</div>
```

---

### Task 6: Update empty states

**Files:**
- Modify: `frontend/src/routes/random/+page.svelte` (template)

- [ ] **Step 1: Replace the `{:else if fetchError}`, `{:else if mode === 'favorites'}`, and `{:else}` blocks**

Replace everything after `{/if}` (the post block) with:

```svelte
{:else if fetchError}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75" />
      <line
        x1="12"
        y1="8"
        x2="12"
        y2="12"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
    {#if offline.value}
      <p class="empty-title">You're offline</p>
      <p class="empty-sub">No cached posts available.</p>
    {:else}
      <p class="empty-title">Connection error</p>
      <p class="empty-sub">Couldn't load the next post.</p>
      <button class="retry-btn" onclick={retryFetch}>Try again</button>
    {/if}
  </div>
{:else if mode === 'cached'}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.75" />
      <polyline
        points="8 12 11 15 16 9"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>
    {#if offline.value}
      <p class="empty-title">You're offline</p>
      <p class="empty-sub">No cached posts available.</p>
    {:else}
      <p class="empty-title">No cached posts</p>
      <p class="empty-sub">Cache your favorites in Settings to browse offline.</p>
      <a class="retry-btn" href="/settings">Go to Settings</a>
    {/if}
  </div>
{:else if mode === 'favorites'}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <p class="empty-title">No favorites yet</p>
    <p class="empty-sub">Posts you remember will appear here.</p>
    <button class="retry-btn" onclick={switchMode}>Browse all posts</button>
  </div>
{:else}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.75" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
    </svg>
    <p class="empty-title">All caught up!</p>
    <p class="empty-sub">Come back later for new posts.</p>
  </div>
{/if}
```

Note: The "No favorites" empty state previously had an offline sub-state. Since going offline now forces `cached` mode, that branch is no longer reachable — it has been removed.

Note: The "Browse all posts" CTA calls `switchMode()` (no argument now) which cycles to the next mode. Since we're in `favorites`, next is `cached`. Consider whether this CTA still makes sense — it will now go to `cached`, not directly to `all`. If `cached` is undesirable here, change to `onclick={() => { mode = 'all'; localStorage.setItem(MODE_KEY, 'all'); loadNext(); }}`. For simplicity, keep `switchMode()` — it's one extra click at most.

Actually, to avoid confusion on the "Browse all posts" CTA (which would now cycle to `cached` not `all`), replace it with a direct reset:

```svelte
<button class="retry-btn" onclick={async () => {
  mode = 'all';
  if (typeof localStorage !== 'undefined') localStorage.setItem(MODE_KEY, 'all');
  post = null;
  loading = true;
  await loadNext();
}}>Browse all posts</button>
```

---

### Task 7: Add CSS for the `cached` mode chip

**Files:**
- Modify: `frontend/src/routes/random/+page.svelte` (style section)

- [ ] **Step 1: Update the `.mode-chip` CSS**

The existing `.mode-chip.active` class is no longer used (replaced by `.mode-chip.favorites` and `.mode-chip.cached`). Replace:

```css
.mode-chip.active {
  color: var(--color-favorite);
  border-color: var(--color-favorite);
}
```

With:

```css
.mode-chip.favorites {
  color: var(--color-favorite);
  border-color: var(--color-favorite);
}

.mode-chip.cached {
  color: var(--color-cached, #3b82f6);
  border-color: var(--color-cached, #3b82f6);
}
```

- [ ] **Step 2: Add `.retry-btn` anchor style**

The "Go to Settings" CTA in the cached empty state is an `<a>` tag. The existing `.retry-btn` styles apply to `<button>`. Add an anchor variant so it looks identical:

After the existing `.retry-btn` rule, add:

```css
a.retry-btn {
  display: inline-block;
  text-decoration: none;
}
```

---

### Task 8: Final verification and commit

- [ ] **Step 1: Run the dev server and test all mode transitions**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/random` and verify:
1. Pill shows "All" by default; clicking cycles to "Favorites" then "Cached" then back to "All"
2. "All" mode: Forget + Remember buttons shown
3. "Favorites" mode: Forget + Next shown; empty state if no favorites
4. "Cached" mode: Next only; empty state with Settings link if no cached posts
5. Simulate offline (DevTools → Network → Offline): mode auto-switches to "Cached", pill is disabled
6. Return online: mode stays "Cached", pill becomes clickable

- [ ] **Step 2: Build to catch any type or import errors**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/random/+page.svelte frontend/src/routes/random/+page.js
git commit -m "$(cat <<'EOF'
feat: add cached mode to random page for offline browsing

Introduces a third mode (all → favorites → cached) on the random page.
Cached mode picks from locally-stored favorites filtered by SW cache presence,
works fully offline. Going offline auto-switches to cached and locks the pill.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
