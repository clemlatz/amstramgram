# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Self-hosted web UI for browsing media downloaded by Instaloader, Gramoire, or other tools. Python backend (FastAPI), SvelteKit frontend compiled as a static SPA, served by FastAPI in production.

## Architecture

```
amstramgram/
├── api/              — FastAPI backend (Python)
├── frontend/         — SvelteKit frontend (adapter-static → SPA)
│   ├── src/
│   └── static/
├── userscript/       — Tampermonkey userscript (separate sub-project, own CLAUDE.md)
├── Dockerfile        — Multi-stage: Node build + Python runtime
└── docker-compose.yml
```

> `userscript/` is a standalone JavaScript project with its own `CLAUDE.md`. It is a modular browser userscript for Instagram — built by concatenation of `src/` files via `npm run build`, no bundler.

### FastAPI backend (`api/`)

| File | Role |
|---|---|
| `main.py` | FastAPI app, mounts routes and static files |
| `config.py` | Environment variables (including scheduler tuning) |
| `db.py` | SQLite queries (feed, random, rate, stats, settings, indexing) |
| `loader.py` | Instaloader instance, session management |
| `scheduler.py` | Background import loop (start/stop via `/api/settings`) |
| `importer.py` | Gramoire import-from-disk logic (count pending files, run import) |
| `saved.py` | Import saved posts from Instagram |
| `logs.py` | In-memory log buffer with file persistence (`GET /api/logs`) |
| `notifier.py` | Telegram alerts (cycle start/completion/errors) |
| `patches.py` | Monkey-patches for third-party libraries (Instaloader) |
| `routes/` | HTTP handlers (see API routes below) |

### API routes

| Route | Description |
|---|---|
| `GET /api/feed` | Last 9 photos |
| `GET /api/random` | Random unrated photo |
| `POST /api/rate` | Rate a photo (`archive` / `favorite` / `clear`) |
| `GET /api/media/{encoded}` | Serve an image or video file (base64url-encoded path) |
| `GET /api/stats` | Statistics (accounts, total count, disk usage) |
| `GET /api/accounts` | List followed accounts |
| `POST /api/accounts/import-following` | Import following list from the platform |
| `GET /api/accounts/{username}` | Get account details |
| `PATCH /api/accounts/{username}` | Toggle `active` or `hidden` status |
| `POST /api/accounts/{username}/archive` | Archive an account |
| `GET /api/accounts/{username}/avatar` | Serve an account's profile picture |
| `GET /api/accounts/{username}/posts` | Get all posts for an account |
| `GET /api/accounts/{username}/preview` | Get preview media for an account (last 5) |
| `GET /api/settings` | Get current settings (includes `pending_imports`) |
| `POST /api/settings/session` | Update session ID |
| `POST /api/settings/user-agent` | Update user agent |
| `POST /api/settings/scheduler/start` | Start the background scheduler |
| `POST /api/settings/scheduler/stop` | Stop the background scheduler |
| `POST /api/settings/import-now` | Run one import cycle immediately, independent of the scheduler's timing |
| `POST /api/settings/import-saved` | Import saved posts from Instagram |
| `POST /api/settings/import-from-disk` | Trigger manual Gramoire import from disk |
| `GET /api/logs` | Recent application log entries (last 100) |

All routes consumed by the `userscript/` (a non-interactive client that cannot complete the SPA's OAuth flow) live under the `/api/userscript/` prefix, so a reverse-proxy auth layer (e.g. oauth-proxy) can allow-list that one prefix instead of enumerating individual paths:

| Route | Description |
|---|---|
| `GET /api/userscript/accounts/{username}/posts` | Get all posts for an account (mirrors `GET /api/accounts/{username}/posts`, used by the userscript's skip-history check) |
| `GET /api/userscript/shortcodes` | All known shortcodes, for local download-history dedup |

### Frontend (`frontend/`)

SvelteKit with `adapter-static` (SPA mode: `ssr = false`, `prerender = false`). Built output in `frontend/build/` is served by FastAPI via a `_SPAFiles` catch-all that falls back to `index.html`.

**Routes:**

| Path | Page |
|---|---|
| `/` | Feed — last 9 photos |
| `/random` | Pick — rate a random unrated photo |
| `/following` | Following list (all accounts) |
| `/accounts/[username]` | Account detail + post grid |
| `/settings` | Settings, scheduler, import |

**Key conventions:**
- Uses **Svelte 5 runes** syntax throughout (`$props()`, `$state()`, `$derived()`, `$effect()`).
- `$lib/audio.svelte.js` and `$lib/offline.svelte.js` are rune-based reactive singletons (module-level `$state`).
- The layout polls `/api/stats` every 10–15 s to detect server reachability; sets `offline.value` which hides data pages.
- **Responsive layout**: bottom tab bar on mobile, left sidebar at 768px+.
- **PWA**: `VitePWA` plugin with a custom `src/sw.js` service worker using `injectManifest` strategy.

### Storage

- SQLite DB: `$STORAGE_BASE/amstramgram.db` (Docker default: `/storage/amstramgram.db`)
- Media: `$STORAGE_BASE/media/{platform_user_id}/` (Docker default: `/storage/media/{id}/`)
- Log: `$STORAGE_BASE/amstramgram.log`
- Gramoire imports: `$STORAGE_BASE/imports/` (drop files here before importing from disk)

**SQLite schema (5 tables):** `accounts`, `media`, `ratings` (keyed by shortcode), `settings` (key/value), `saved_seen` (tracks already-seen saved posts).

## Commands

```bash
# Install dependencies (creates .venv + installs Python deps)
make install

# Run all tests
make test

# Run a single test file or function
.venv/bin/pytest tests/test_db.py -v
.venv/bin/pytest tests/test_db.py::test_index_account -v

# Dev — run FastAPI + SvelteKit dev server in parallel (single terminal)
make dev               # backend on PORT (.env default 8000) + Vite proxy at :5173

# Backend only
make start

# Production — Docker
cp .env.example .env
docker compose up -d --build

# Build SvelteKit only
cd frontend && npm run build   # → frontend/build/ (served by FastAPI in production)

# Import media from Gramoire drop folder
make import
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | FastAPI backend port (dev only) |
| `STORAGE_BASE` | `/storage` | Storage root (DB, media, log, imports) |
| `DRY_RUN` | `false` | Skip all imports (for testing) |
| `ENABLE_ACCESS_LOG` | `false` | Enable HTTP access logs |
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token for alerts |
| `TELEGRAM_CHAT_ID` | — | Telegram chat ID for alerts |

### Scheduler tuning

All scheduler delays are configurable. Defaults are intentionally conservative.

| Variable | Default | Description |
|---|---|---|
| `IMPORT_ACCOUNTS_PER_CYCLE_MIN` | `5` | Min accounts checked per cycle |
| `IMPORT_ACCOUNTS_PER_CYCLE_MAX` | `10` | Max accounts checked per cycle |
| `IMPORT_MAX_RECENT_POSTS` | `5` | Max recent posts fetched per not-yet-fully-imported account |
| `IMPORT_BACKFILL_MIN` | `30` | Min posts per account during historical backfill |
| `IMPORT_BACKFILL_MAX` | `60` | Max posts per account during historical backfill |
| `IMPORT_POST_DELAY_MIN` | `10` | Min delay between downloaded posts (s) |
| `IMPORT_POST_DELAY_MAX` | `30` | Max delay between downloaded posts (s) |
| `IMPORT_ACCOUNT_DELAY_MIN` | `60` | Min delay between accounts within a group (s) |
| `IMPORT_ACCOUNT_DELAY_MAX` | `180` | Max delay between accounts within a group (s) |
| `IMPORT_GROUP_DELAY_MIN` | `600` | Min delay between groups (s) |
| `IMPORT_GROUP_DELAY_MAX` | `1200` | Max delay between groups (s) |
| `IMPORT_BACKFILL_DELAY_MIN` | `180` | Min delay between backfill accounts (s) |
| `IMPORT_BACKFILL_DELAY_MAX` | `360` | Max delay between backfill accounts (s) |
| `IMPORT_CYCLE_DELAY_MIN` | `43200` | Min delay between full cycles (s) — 12 h |
| `IMPORT_CYCLE_DELAY_MAX` | `86400` | Max delay between full cycles (s) — 24 h |
| `IMPORT_INITIAL_DELAY_MIN` | `300` | Min initial startup delay (s) — 5 min |
| `IMPORT_INITIAL_DELAY_MAX` | `1800` | Max initial startup delay (s) — 30 min |
| `IMPORT_MORNING_JITTER_MIN` | `300` | Min jitter after overnight pause (s) — 5 min |
| `IMPORT_MORNING_JITTER_MAX` | `7200` | Max jitter after overnight pause (s) — 2 h |
| `IMPORT_ENABLE_BACKFILL` | `false` | Enable historical backfill (`fetch_old_posts`) |
| `IMPORT_RATE_LIMIT_RETRIES` | `2` | Max consecutive rate-limit errors before stopping |
| `IMPORT_RATE_LIMIT_BACKOFF_BASE` | `1800` | Base backoff for rate-limit errors (s) — 30 min |
| `IMPORT_RATE_LIMIT_BACKOFF_MAX` | `10800` | Max backoff for rate-limit errors (s) — 3 h |

> The session ID is stored in the database and managed via the `/settings` page.

## Incremental import mechanism

- `.done` sentinel file in each account's storage folder (legacy — migrated to `fully_imported` DB column)
- Without `fully_imported` → fetch only recent posts per cycle, backfill separately
- With `fully_imported` → `fast_update=True` (stops at the first already-known post)
- Default cycle delay: 12–24 h (`IMPORT_CYCLE_DELAY_MIN/MAX`)

## Naming conventions

| Concept | Canonical term | Examples |
|---|---|---|
| Instagram → server (scheduler) | **import** | `imported_at`, `_import_account`, `import_lock` |
| Gramoire files → server (manual) | **import from disk** | button "Import from disk", `/api/settings/import-from-disk` |
| Server → user device (explicit) | **download** | button "Download", `/api/download` endpoint |

## Language

All code, comments, documentation, and communication in this project must be in English.
