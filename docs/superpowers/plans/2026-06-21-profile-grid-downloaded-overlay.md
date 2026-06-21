# Profile Grid — Downloaded Post Overlay

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Instagram profile pages, mark posts that are already in the local download history with a dark overlay and a checkmark badge on the grid thumbnail.

**Architecture:** A `MutationObserver` watches `<main>` for newly inserted `<a>` links on profile pages. Each new link's shortcode is checked against the in-memory `downloadHistorySet`. Marked links receive two injected child elements (overlay div + badge div) and a `data-ig-hd-downloaded` attribute. The observer starts/stops automatically as the user navigates between profile and non-profile pages via the existing SPA hook (`scheduleSettingsLauncherSync`).

**Tech Stack:** Vanilla JS (no bundler), Tampermonkey userscript, CSS custom properties already defined in the codebase.

## Global Constraints

- All code, comments, and identifiers must be in English.
- Single file change: `userscript/src/main.js` only. Do NOT edit the compiled `amstragram.js` — it is gitignored.
- No new files, no new modules, no new IIFEs. The new code is added inline inside the existing main IIFE.
- Follow the existing pattern: CSS in the `style` template literal at the top, JS functions as `function` declarations inside the IIFE.
- No test suite exists. Testing is manual (load in Tampermonkey, visit a profile page).
- Run `npm run build && npm run verify` from `userscript/` after every task to validate the build.

---

### Task 1: Add CSS for grid overlay and badge

**Files:**
- Modify: `userscript/src/main.js:2596` (just before `@media (max-width: 700px)` at line 2597)

**Interfaces:**
- Produces: CSS classes `.ig-hd-grid-overlay` and `.ig-hd-grid-badge`, plus attribute selector `a[data-ig-hd-downloaded]` used by Task 2.

- [ ] **Step 1: Locate the insertion point**

Open `userscript/src/main.js` and find the following block (around line 2591–2596):

```js
    .ig-hd-download-btn:disabled {
      background: #18208b;
      color: #ffffff;
      opacity: 1;
      cursor: not-allowed;
    }
    @media (max-width: 700px) {
```

The new CSS must be inserted between the `.ig-hd-download-btn:disabled` closing brace and the `@media` line.

- [ ] **Step 2: Insert the CSS**

Insert the following CSS block between line 2596 and line 2597:

```css
    /* Profile grid — downloaded post markers */
    a[data-ig-hd-downloaded] { position: relative; }
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
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    [data-ig-hd-theme="light"] .ig-hd-grid-overlay { background: rgba(0, 0, 0, 0.25); }
    [data-ig-hd-theme="light"] .ig-hd-grid-badge { background: rgba(255, 255, 255, 0.7); }
    [data-ig-hd-theme="light"] .ig-hd-grid-badge svg { stroke: #333; }
```

- [ ] **Step 3: Build and verify**

```bash
cd userscript && npm run build && npm run verify
```

Expected: build succeeds, verify prints no errors.

- [ ] **Step 4: Commit**

```bash
git add userscript/src/main.js
git commit -m "feat(userscript): add CSS for profile grid downloaded-post overlay"
```

---

### Task 2: Add `observeProfileGrid` module and wire it in

**Files:**
- Modify: `userscript/src/main.js`
  - Add module (~60 lines) just before the `// INIT WIRING` section (~line 20003)
  - Add `syncProfileGridObserver()` call in `scheduleSettingsLauncherSync` → `runSync` closure (~line 7126)
  - Add `syncProfileGridObserver()` call in the init block (~line 9680)

**Interfaces:**
- Consumes:
  - `getCurrentProfileUsername()` (line 6568) — returns `""` if not on a profile page
  - `extractInstagramPostShortcodeFromHref(href)` (line 11039) — returns shortcode string or `null`
  - `hasDownloadedHistoryKey(key)` (line 3415) — returns `true` if `key` is in download history
  - CSS classes added in Task 1: `ig-hd-grid-overlay`, `ig-hd-grid-badge`
  - Data attribute `data-ig-hd-downloaded` added in Task 1
- Produces: `syncProfileGridObserver()` — public entry point called by the SPA hook and init.

**Sub-steps:**

- [ ] **Step 1: Add the module before INIT WIRING**

Find the `// INIT WIRING AND GLOBAL RIGHT-CLICK LISTENER` comment (around line 20003) and insert the following block just before it:

```js
  // =========================================
  // PROFILE GRID — DOWNLOADED POST OVERLAY
  // =========================================
  let _profileGridObserver = null;
  let _profileGridSeenLinks = new Set();

  function _markProfileGridLink(link) {
    const overlay = document.createElement("div");
    overlay.className = "ig-hd-grid-overlay";
    const badge = document.createElement("div");
    badge.className = "ig-hd-grid-badge";
    badge.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    link.setAttribute("data-ig-hd-downloaded", "1");
    link.appendChild(overlay);
    link.appendChild(badge);
  }

  function _processProfileGridLinks(links) {
    for (const link of links) {
      if (_profileGridSeenLinks.has(link)) continue;
      _profileGridSeenLinks.add(link);
      const href = link.getAttribute("href") || "";
      const shortcode = extractInstagramPostShortcodeFromHref(href);
      if (!shortcode) continue;
      if (hasDownloadedHistoryKey(`shortcode:${shortcode}`)) {
        _markProfileGridLink(link);
      }
    }
  }

  function _startProfileGridObserver() {
    const root = document.querySelector("main") || document.body;
    if (!root || typeof MutationObserver !== "function") return;

    const selector = "a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']";

    const initialLinks = root.querySelectorAll(selector);
    _processProfileGridLinks(initialLinks);

    _profileGridObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          const links = [];
          if (node.matches?.(selector)) links.push(node);
          const nested = node.querySelectorAll?.(selector);
          if (nested) links.push(...nested);
          if (links.length > 0) _processProfileGridLinks(links);
        }
      }
    });

    _profileGridObserver.observe(root, { childList: true, subtree: true });
  }

  function _stopProfileGridObserver() {
    if (_profileGridObserver) {
      _profileGridObserver.disconnect();
      _profileGridObserver = null;
    }
    _profileGridSeenLinks = new Set();
    const marked = document.querySelectorAll("[data-ig-hd-downloaded]");
    for (const el of marked) {
      el.removeAttribute("data-ig-hd-downloaded");
      el.querySelector(".ig-hd-grid-overlay")?.remove();
      el.querySelector(".ig-hd-grid-badge")?.remove();
    }
  }

  function syncProfileGridObserver() {
    const username = getCurrentProfileUsername();
    if (!username) {
      _stopProfileGridObserver();
      return;
    }
    _stopProfileGridObserver();
    _startProfileGridObserver();
  }
```

- [ ] **Step 2: Wire into `scheduleSettingsLauncherSync`'s `runSync`**

Find the `runSync` inner function inside `scheduleSettingsLauncherSync` (around line 7122):

```js
    const runSync = () => {
      settingsLauncherSyncTimeout = null;
      settingsLauncherSyncLastRun = Date.now();
      if (USER_SETTINGS?.theme === "auto") applyTheme();
      syncSettingsLauncherButton();
    };
```

Add `syncProfileGridObserver()` after `syncSettingsLauncherButton()`:

```js
    const runSync = () => {
      settingsLauncherSyncTimeout = null;
      settingsLauncherSyncLastRun = Date.now();
      if (USER_SETTINGS?.theme === "auto") applyTheme();
      syncSettingsLauncherButton();
      syncProfileGridObserver();
    };
```

- [ ] **Step 3: Wire into the init block**

Find the initialization block (around line 9680):

```js
  if (document.body) {
    applyTheme();
    syncSettingsLauncherButton();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      applyTheme();
      syncSettingsLauncherButton();
    }, { once: true });
  }
```

Add `syncProfileGridObserver()` after each `syncSettingsLauncherButton()` call:

```js
  if (document.body) {
    applyTheme();
    syncSettingsLauncherButton();
    syncProfileGridObserver();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      applyTheme();
      syncSettingsLauncherButton();
      syncProfileGridObserver();
    }, { once: true });
  }
```

- [ ] **Step 4: Build and verify**

```bash
cd userscript && npm run build && npm run verify
```

Expected: build succeeds, verify prints no errors.

- [ ] **Step 5: Manual smoke test**

1. Load `amstragram.js` in Tampermonkey (or reload the extension).
2. Navigate to an Instagram profile page of an account you've previously downloaded posts from (e.g. via bulk download in the same browser).
3. **Expected:** Posts with shortcodes in the local download history show a dark semi-transparent overlay and a white checkmark badge in the top-right corner of the thumbnail. Posts not in history have no overlay.
4. Scroll down to trigger infinite load → newly added posts should also be marked correctly.
5. Navigate away to the feed (`/`) → overlays are removed, observer is stopped.
6. Navigate back to the same profile → overlays reappear on the correct posts.
7. Open Settings → switch between dark and light themes → overlay color adjusts accordingly.

- [ ] **Step 6: Commit**

```bash
git add userscript/src/main.js
git commit -m "feat(userscript): mark downloaded posts on profile grid with overlay and badge"
```
