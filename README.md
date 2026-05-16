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

## Requirements

- Python 3.12+
- Node.js 22+
## Development setup

### 1. Backend

Create a virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r api/requirements.txt
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
source .venv/bin/activate
cp .env.example .env   # adjust storage paths if needed
python -m api
```

The backend starts a background scheduler that downloads accounts stored in the database and exposes the API on `http://localhost:8000`.

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
| `DB_PATH` | `/storage/amstragram/amstramgram.db` | SQLite database path |
| `STORAGE_BASE` | `/storage/amstramgram` | Media storage root |
| `DRY_RUN` | `false` | Skip all downloads (for testing) |
| `ENABLE_ACCESS_LOG` | `false` | Enable HTTP access logs |