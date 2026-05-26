-- Migration 002: Rename downloaded_at → synced_at in the media table
--
-- Rationale: "downloaded_at" was ambiguous — it conflated the Instagram→server
-- sync flow with the server→device download flow. The canonical term for
-- Instagram→server is now "sync", so the column is renamed accordingly.
--
-- Idempotency: the Python init_db() function in api/db.py applies this rename
-- at startup only when downloaded_at exists and synced_at does not yet exist,
-- making this script safe to run multiple times.
--
-- This script targets SQLite ≥ 3.25.0 (ALTER TABLE … RENAME COLUMN support).

PRAGMA user_version;
-- Expected: run this migration when user_version < 2

ALTER TABLE media RENAME COLUMN downloaded_at TO synced_at;

PRAGMA user_version = 2;
