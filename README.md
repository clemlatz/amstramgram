<div align="center">
  <img src="frontend/static/logo.png" alt="Amstramgram" width="160" />

  <h1>Amstramgram</h1>

  <p>Amstramgram is a web UI for browsing media downloaded by <a href="https://instaloader.github.io/">Instaloader</a>, <a href="https://greasyfork.org/en/scripts/566467-gramoire-an-actual-good-instagram-downloader">Gramoire</a>, or other tools. Self-hosted, read-only.</p>

  [![Python](https://img.shields.io/badge/Python-3.12+-3776ab?logo=python&logoColor=white)](https://www.python.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![Svelte](https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte&logoColor=white)](https://svelte.dev/)
  [![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white)](https://www.docker.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

> **Experimental personal project.** I built Amstramgram to learn Python, Svelte, and [Claude Code](https://claude.ai/code). A large part of the codebase was written by Claude Code — including this sentence.

> **What's an amstramgram?** It's a French children's counting rhyme — the equivalent of "eeny, meeny, miny, moe." The name fits: the app picks a random photo for you to keep or discard.

## Features

- **Feed** — chronological grid of all downloaded media
- **Random** — swipe through photos one at a time, mark them as favorite or archive
- **Following** — list of followed accounts with profile pictures and post counts
- **Settings** — manage session, scheduler, saved-post import, and Gramoire imports from disk

## Requirements

- Python 3.12+
- Node.js 22+
## Development setup

### 1. Backend

```bash
make install
```

### 2. Frontend

```bash
cd frontend
npm install
```

### 3. Run

Open two terminals from the project root.

**Terminal 1 — FastAPI**

```bash
cp .env.example .env   # adjust storage paths if needed
make start
```

The backend starts a background scheduler that imports media from followed accounts and exposes the API on `http://localhost:8000`.

**Terminal 2 — SvelteKit**

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. API calls to `/api/*` are proxied to `:8000` automatically.

## Production — Docker

```bash
cp .env.example .env

docker compose up -d --build
```

The image is built in two stages: Node 22 compiles the SvelteKit SPA, then Python 3.12 serves both the API and the static files on port 8000.

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Backend port (dev only) |
| `STORAGE_BASE` | `/storage` | Media storage root (DB stored here too) |
| `DRY_RUN` | `false` | Skip all imports (for testing) |
| `ENABLE_ACCESS_LOG` | `false` | Enable HTTP access logs |

## Importing media from Gramoire

Amstramgram can import media files downloaded by [Gramoire](https://greasyfork.org/en/scripts/566467-gramoire-an-actual-good-instagram-downloader).

### How it works

1. Drop your media files and their `.json` sidecars into `STORAGE_BASE/imports/`
2. Trigger the import — either from the **Settings page** in the web UI, or via the CLI script:

```bash
python import_media.py
```

The import moves each file to `STORAGE_BASE/media/{account_id}/`, creates the account if it doesn't exist yet (inactive), and skips duplicates.

The script reads `STORAGE_BASE` and `DB_PATH` from your `.env` by default. You can override them:

```bash
python import_media.py --storage /path/to/storage --db /path/to/amstramgram.db
```

Use `--dry-run` to preview what would be imported without making any changes:

```bash
python import_media.py --dry-run
```

### Requirements

Gramoire must be configured to export metadata sidecars alongside each download (schema `gramoire-media-metadata-v1.2` or later). Each media file needs a `.json` sidecar with the same stem — files without a sidecar are skipped with a warning.