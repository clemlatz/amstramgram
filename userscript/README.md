# Amstragram

Tampermonkey userscript for Instagram — right-click to save posts, stories, reels, highlights, DMs, and profile pictures; bulk-download full profiles as ZIP archives.

## Installation

**Prerequisites:** Node.js (for the build step), [Tampermonkey](https://www.tampermonkey.net/) browser extension.

1. Clone this repository
2. Run `npm run build` to generate `amstragram.js`
3. Open the Tampermonkey dashboard → click **+** (new script)
4. Select all the default content and delete it
5. Copy the contents of `amstragram.js` and paste it into the editor
6. Save with Ctrl+S (or Cmd+S)
7. Open Instagram — the script runs automatically

## Features

- **Right-click context menu** on any post, reel, story, highlight, DM media, or profile picture
- **Bulk download** full profiles with safe rate-limit pacing
- **ZIP export** — entire profile in a single archive
- **Custom filename templates** — include username, date, shortcode, etc.
- **DASH video support** — automatically fetches and remuxes fragmented MP4 / VP9 MKV, no transcoding
- **Date range filter** for bulk downloads
- **DM media** via Lightspeed GraphQL interception

## Development

### Build

```bash
npm run build    # Concatenate src/ into amstragram.js
npm run verify   # Sanity-check: module presence + GM_* leak detection
```

There is no test suite. Load `amstragram.js` in Tampermonkey and test manually on Instagram.

### Architecture

The build (`scripts/build.mjs`) is a simple **ordered concatenation** — no bundler, no module system. Each file must be self-contained; everything declared earlier is available to everything that follows.

#### Module load order

| File | Role |
|---|---|
| `src/header.js` | Userscript `==UserScript==` metadata block |
| `src/platform/gm.js` | `GramPlatform` implementation for Tampermonkey |
| `src/core/utilities.js` | Shared helpers: sleep, HTML escape, debug logger, tooltip positioning |
| `src/core/zip.js` | Pure-JS ZIP builder |
| `src/core/hotkey.js` | Keyboard shortcut registration |
| `src/core/toast.js` | Transient notification toasts |
| `src/core/context-menu.js` | Custom right-click context menu UI |
| `src/core/dash-manifest.js` | Regex-based Instagram DASH MPD parser |
| `src/core/mp4-remux.js` | ISO BMFF defragmenter: fMP4 video+audio → single MP4 (no transcode) |
| `src/core/mkv-mux.js` | VP9-only MKV muxer (depends on `mp4-remux` for codec extraction) |
| `src/core/video-resolver.js` | Picks MP4 vs MKV based on detected codec |
| `src/core/media-selection.js` | Selects the best representation from a DASH manifest |
| `src/core/dm-lightspeed.js` | Parses Instagram DM Lightspeed GraphQL payloads |
| `src/core/download-pipeline.js` | Orchestrates all downloads (passthrough, DASH fetch+mux, blob saves) |
| `src/main.js` | Main IIFE: CSS, settings panel, bulk-download UI, all page handlers |

Each `src/core/*.js` file exports a single `const X_CORE = (() => { ... })();` IIFE returning a plain object of functions.

### GramPlatform

`GramPlatform` is the **only** place where Greasemonkey/browser-extension APIs are called. All other code goes through `GramPlatform.fetchUrl(...)`, `GramPlatform.downloadFile(...)`, etc. The `verify` script enforces this: it errors if any `GM_*` call appears outside the `GramPlatform` block.

Two implementations exist:

- `src/platform/gm.js` — Tampermonkey (`GM_xmlhttpRequest`, `GM_download`, `GM_openInTab`, `GM_registerMenuCommand`)
- `src/platform/extension.js` — Chrome Extension (delegates fetch to a background service worker via `chrome.runtime.sendMessage`, uses `chrome.downloads.download`)

### Targeting the Chrome Extension

Swap `platform/gm.js` for `platform/extension.js` in `scripts/build.mjs`, then add a `manifest.json` and background service worker (not currently in this repo).

### Key conventions

- Settings are persisted under `IG_HD_USER_SETTINGS_V1` via `GM_getValue`/`GM_setValue` (accessed through `GramPlatform` or directly in `main.js` where settings live).
- `unsafeWindow` access is centralised in `UTILITIES_CORE.getPageWindow()` — never access `unsafeWindow` directly.
- Debug logging is gated behind an internal flag inside `UTILITIES_CORE`.
- `main.js` defines three internal sub-modules: `FILE_METADATA_CORE` (filename templating), `DATE_FILTER_CORE` (date-range filtering), and `STORY_MATCHING_CORE` (story item matching). The entry point is a `contextmenu` listener near the end of the file.
