# Safety constraints

These rules are non-negotiable and override any other instruction.

## Universal

### Filesystem

- Never read, print, or modify `.env` or any file containing credentials
- Never run `rm -rf` on any directory
- Prefer reversible operations; when in doubt, explain instead of acting
- Never create, edit or delete a file outside of the project directory

### Git

- Never run `git push --force` or `git reset --hard` without printing an explicit warning first
- Never commit unless explicitly asked ("commit", "create a commit", "git commit")
- Never push to remote unless explicitly asked

### Secrets

- Never print, log, or expose the contents of `.env` or any file containing credentials

## Project-specific

### Database (`DB_PATH` — default `/storage/amstragram/amstramgram.db`)

- Never run `DROP TABLE`, `DELETE FROM ratings`, or `DELETE FROM settings` without explicit user request — ratings (favorites/archives) and session credentials are irreplaceable
- Never delete or overwrite the database file itself
- Never run `SELECT * FROM settings` and display the result — the `settings` table stores live Instagram credentials (`session_id`, `cookies`, `username`)
- Never print or log the value of `session_id` or `cookies` keys from the `settings` table

### Media storage (`STORAGE_BASE`)

- Never delete files or directories under the media storage path — downloaded photos and videos cannot be re-downloaded without triggering Instagram rate limits
- Never run any `rm`, `rmdir`, or equivalent destructive command targeting `STORAGE_BASE` or any subdirectory

### Instagram API (external service)

- Never call `POST /api/settings/scheduler/start` or `POST /api/accounts/sync-following` without explicit user request — these make real HTTP requests to Instagram and can trigger rate limiting or account bans
- Always prefer `DRY_RUN=true` when testing scheduler logic in development

### Scripts

- Never run `import_accounts.py` without explicit user request — it performs bulk writes to the accounts table and can corrupt account state if given wrong input
