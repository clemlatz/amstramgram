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
├── Dockerfile        — Multi-stage: Node build + Python runtime
└── docker-compose.yml
```

### FastAPI backend (`api/`)

| File | Role |
|---|---|
| `main.py` | FastAPI app, mounts routes and static files |
| `config.py` | Environment variables |
| `db.py` | SQLite queries (feed, random, rate, stats, settings, indexing) |
| `loader.py` | Instaloader instance, session management |
| `scheduler.py` | Background download loop (start/stop via `/api/settings`) |
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
| `GET /api/accounts/{username}/avatar` | Serve an account's profile picture |
| `GET /api/settings` | Get current settings |
| `POST /api/settings/session` | Update session ID |
| `POST /api/settings/user-agent` | Update user agent |
| `POST /api/settings/scheduler/start` | Start the background scheduler |
| `POST /api/settings/scheduler/stop` | Stop the background scheduler |

### Storage

- SQLite DB: `DB_PATH` (Docker default: `/storage/amstragram/amstramgram.db`)
- Media: `STORAGE_BASE` (Docker default: `/storage/amstramgram/{account}/`)

## Commands

```bash
# Install dependencies (creates .venv + installs Python deps)
make install

# Run tests
make test

# Dev — run FastAPI + SvelteKit in parallel
make start             # backend — reads PORT from .env (default 8000)

cd frontend && npm run dev   # in another terminal — proxies /api → PORT from .env

# Production — Docker
cp .env.example .env
docker compose up -d --build

# Build SvelteKit only
cd frontend && npm run build   # → frontend/build/ (served by FastAPI in production)
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | FastAPI backend port (dev only) |
| `DB_PATH` | `/storage/amstragram/amstramgram.db` | SQLite database path |
| `STORAGE_BASE` | `/storage/amstramgram` | Media storage root directory |
| `DRY_RUN` | `false` | Skip all downloads (for testing) |
| `ENABLE_ACCESS_LOG` | `false` | Enable HTTP access logs |

> The session ID is stored in the database and managed via the `/settings` page.

## Incremental download mechanism

- `.done` sentinel file in each account's storage folder
- Without `.done` → full download
- With `.done` → `fast_update=True` (stops at the first already-known post)
- Random 10–60 min delay between each cycle

## Language

All code, comments, documentation, and communication in this project must be in English.
