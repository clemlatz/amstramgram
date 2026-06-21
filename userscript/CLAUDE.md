# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`amstragram.js` is a Tampermonkey/Greasemonkey userscript for Instagram. It is the **compiled output** of the modular sources in `src/` — it is gitignored and must never be edited directly. All changes go to `src/`.

## Commands

```bash
npm run build    # Concatenate src/ files into amstragram.js
npm run verify   # Sanity-check the built amstragram.js (module presence + GM leak detection)
```

There is no test suite. After a build, load `amstragram.js` in Tampermonkey and test manually on Instagram.

## Architecture

The build (`scripts/build.mjs`) is a simple ordered concatenation — no bundler, no module system. Files are joined in declaration order so each module is available to everything that follows it.

### Build order (src/)

```
header.js              ← Userscript ==UserScript== metadata + GramPlatform section banner
platform/gm.js         ← GramPlatform implementation for Tampermonkey (swap for extension.js for Chrome Extension)
core/utilities.js      ← Shared helpers (sleep, HTML escape, debug logger, tooltip positioning)
core/zip.js            ← Pure-JS ZIP builder
core/hotkey.js         ← Keyboard shortcut registration
core/toast.js          ← Transient notification toasts
core/context-menu.js   ← Custom right-click context menu UI
core/dash-manifest.js  ← Regex-based Instagram DASH MPD parser
core/mp4-remux.js      ← ISO BMFF defragmenter: fMP4 video+audio → single MP4 (no transcode)
core/mkv-mux.js        ← VP9-only MKV muxer (depends on mp4-remux for codec extraction)
core/video-resolver.js ← Picks MP4 vs MKV based on detected codec
core/media-selection.js← Selects best representation from a DASH manifest
core/dm-lightspeed.js  ← Parses Instagram DM Lightspeed GraphQL payloads
core/download-pipeline.js ← Orchestrates all downloads (GM_download passthrough, DASH fetch+mux, blob saves)
core/file-metadata.js  ← Filename templating, sanitization, metadata sidecar building (JSON/XMP)
core/date-filter.js    ← Pure date-range filter helpers for bulk downloads
core/story-matching.js ← Matches story items to DOM/API signals
core/settings-schema.js ← Settings schema: DEFAULT_USER_SETTINGS, all sanitize*/normalize* functions
main.js                ← Main IIFE: CSS, settings storage, batch controller, page handlers
```

Each `core/*.js` file exports a single `const X_CORE = (() => { ... })();` IIFE that returns a plain object of functions.

### GramPlatform

`GramPlatform` is the only place where Greasemonkey/browser-extension APIs (`GM_*`, `chrome.*`) are called. All other code calls `GramPlatform.fetchUrl(...)`, `GramPlatform.downloadFile(...)`, etc. This keeps the platform boundary explicit and testable.

Two implementations exist:
- `src/platform/gm.js` — Tampermonkey (`GM_xmlhttpRequest`, `GM_download`, `GM_openInTab`, `GM_registerMenuCommand`)
- `src/platform/extension.js` — Chrome Extension (delegates fetch to background service worker via `chrome.runtime.sendMessage`, uses `chrome.downloads.download`)

The `verify` script enforces this: it strips comments/strings from the built file and errors if any `GM_*` call appears outside of the `GramPlatform` block.

### Main IIFE (`src/main.js`)

Contains everything that depends on settings state and cannot be cleanly isolated.

The entry point is `document.addEventListener("contextmenu", ...)` near the end of `main.js`. It dispatches to specialized handlers for stories, highlights, profile pictures, DMs, and posts.

### Page-context injection

`main.js` builds a self-contained IIFE string (`hookSource`) injected as a `<script>` element into the page's real JS context. This is the standard userscript pattern for intercepting `fetch` calls, used here to capture DM Lightspeed GraphQL responses.

## Key conventions

- Settings persisted under `IG_HD_USER_SETTINGS_V1`; download history under `IG_HD_DOWNLOAD_HISTORY_V1` (via `GM_getValue`/`GM_setValue` — accessed through `GramPlatform` or directly in `main.js` where settings live).
- `unsafeWindow` / `window.wrappedJSObject` access is centralised in `UTILITIES_CORE.getPageWindow()` — use that, never access `unsafeWindow` directly.
- Debug logging is gated behind `debugLog` inside `UTILITIES_CORE`; enabling it requires toggling its internal flag.
- To target the Chrome Extension build: swap `platform/gm.js` for `platform/extension.js` in `scripts/build.mjs` and add a `manifest.json` + background service worker (not currently in this repo).
