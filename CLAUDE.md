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
| `scheduler.py` | Background sync loop (start/stop via `/api/settings`) |
| `importer.py` | Gramoire import logic (count pending files, run import) |
| `saved.py` | Sync saved posts from Instagram |
| `logs.py` | In-memory log buffer with file persistence (`GET /api/logs`) |
| `notifier.py` | Telegram alerts (cycle start/completion/errors) |
| `patches.py` | Monkey-patches for third-party libraries (Instaloader) |
| `routes/` | HTTP handlers (see API routes below) |

### API routes

| Route | Description |
|---|---|
| `GET /api/feed` | Last 100 photos |
| `GET /api/random` | Random unrated photo |
| `POST /api/rate` | Rate a photo (`archive` / `favorite` / `clear`) |
| `GET /api/media/{encoded}` | Serve an image or video file (base64url-encoded path) |
| `GET /api/stats` | Statistics (accounts, total count, disk usage) |
| `GET /api/accounts` | List followed accounts |
| `POST /api/accounts/sync-following` | Sync following list from the platform |
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
| `POST /api/settings/sync-saved` | Sync saved posts from Instagram |
| `POST /api/settings/import` | Trigger manual Gramoire import |
| `GET /api/logs` | Recent application log entries (last 100) |

### Frontend (`frontend/`)

SvelteKit with `adapter-static` (SPA mode: `ssr = false`, `prerender = false`). Built output in `frontend/build/` is served by FastAPI via a `_SPAFiles` catch-all that falls back to `index.html`.

**Routes:**

| Path | Page |
|---|---|
| `/` | Feed — last 100 photos |
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
- Gramoire imports: `$STORAGE_BASE/imports/` (drop files here before importing)

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
| `DRY_RUN` | `false` | Skip all syncs (for testing) |
| `ENABLE_ACCESS_LOG` | `false` | Enable HTTP access logs |
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token for alerts |
| `TELEGRAM_CHAT_ID` | — | Telegram chat ID for alerts |

### Scheduler tuning

All scheduler delays are configurable. Defaults are intentionally conservative.

| Variable | Default | Description |
|---|---|---|
| `SYNC_ACCOUNTS_PER_CYCLE_MIN` | `5` | Min accounts checked per cycle |
| `SYNC_ACCOUNTS_PER_CYCLE_MAX` | `10` | Max accounts checked per cycle |
| `SYNC_MAX_RECENT_POSTS` | `5` | Max recent posts fetched per unsynced account |
| `SYNC_BACKFILL_MIN` | `30` | Min posts per account during historical backfill |
| `SYNC_BACKFILL_MAX` | `60` | Max posts per account during historical backfill |
| `SYNC_POST_DELAY_MIN` | `10` | Min delay between downloaded posts (s) |
| `SYNC_POST_DELAY_MAX` | `30` | Max delay between downloaded posts (s) |
| `SYNC_ACCOUNT_DELAY_MIN` | `60` | Min delay between accounts within a group (s) |
| `SYNC_ACCOUNT_DELAY_MAX` | `180` | Max delay between accounts within a group (s) |
| `SYNC_GROUP_DELAY_MIN` | `600` | Min delay between groups (s) |
| `SYNC_GROUP_DELAY_MAX` | `1200` | Max delay between groups (s) |
| `SYNC_BACKFILL_DELAY_MIN` | `180` | Min delay between backfill accounts (s) |
| `SYNC_BACKFILL_DELAY_MAX` | `360` | Max delay between backfill accounts (s) |
| `SYNC_CYCLE_DELAY_MIN` | `43200` | Min delay between full cycles (s) — 12 h |
| `SYNC_CYCLE_DELAY_MAX` | `86400` | Max delay between full cycles (s) — 24 h |
| `SYNC_INITIAL_DELAY_MIN` | `300` | Min initial startup delay (s) — 5 min |
| `SYNC_INITIAL_DELAY_MAX` | `1800` | Max initial startup delay (s) — 30 min |
| `SYNC_MORNING_JITTER_MIN` | `300` | Min jitter after overnight pause (s) — 5 min |
| `SYNC_MORNING_JITTER_MAX` | `7200` | Max jitter after overnight pause (s) — 2 h |
| `SYNC_ENABLE_BACKFILL` | `false` | Enable historical backfill (`fetch_old_posts`) |
| `SYNC_RATE_LIMIT_RETRIES` | `2` | Max consecutive rate-limit errors before stopping |
| `SYNC_RATE_LIMIT_BACKOFF_BASE` | `1800` | Base backoff for rate-limit errors (s) — 30 min |
| `SYNC_RATE_LIMIT_BACKOFF_MAX` | `10800` | Max backoff for rate-limit errors (s) — 3 h |

> The session ID is stored in the database and managed via the `/settings` page.

## Incremental sync mechanism

- `.done` sentinel file in each account's storage folder
- Without `.done` → full sync
- With `.done` → `fast_update=True` (stops at the first already-known post)
- Default cycle delay: 12–24 h (`SYNC_CYCLE_DELAY_MIN/MAX`)

## Naming conventions

| Concept | Canonical term | Examples |
|---|---|---|
| Instagram → server (scheduler) | **sync** | `synced_at`, `_sync_account_fast`, `sync_lock` |
| Server → user device (explicit) | **download** | button "Download", `/api/download` endpoint |

## Language

All code, comments, documentation, and communication in this project must be in English.
