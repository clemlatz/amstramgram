<script>
  import Toggle from '$lib/Toggle.svelte';
  let { data } = $props();

  let username = $state(data.username);
  let sessionId = $state(data.session_id ?? '');
  let images = $state(data.images ?? 0);
  let videos = $state(data.videos ?? 0);
  let unrated = $state(data.unrated ?? 0);
  let diskBytes = $state(data.diskBytes ?? 0);
  let cacheBytes = $state(null);

  $effect(() => {
    if ('storage' in navigator) {
      navigator.storage.estimate().then(({ usage }) => {
        cacheBytes = usage ?? null;
      });
    }
  });

  function formatBytes(bytes) {
    if (!bytes) return '–';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
  }
  let loading = $state(false);
  let error = $state(null);
  let showSessionId = $state(false);

  let userAgent = $state(data.user_agent ?? '');
  let uaLoading = $state(false);
  let uaError = $state(null);
  let uaSaved = $state(false);

  let schedulerRunning = $state(data.scheduler_running ?? false);
  let cycleRunning = $state(data.cycle_running ?? false);
  let nextRunAt = $state(data.next_run_at ?? null);
  let schedulerLoading = $state(false);
  let schedulerError = $state(false);

  let importSavedLoading = $state(false);
  let importSavedResult = $state(null);
  let importSavedError = $state(null);

  let pendingImports = $state(data.pending_imports ?? 0);
  let importFromDiskLoading = $state(false);
  let importFromDiskResult = $state(null);
  let importFromDiskError = $state(null);

  let updateLoading = $state(false);
  let updateStatus = $state(null);

  let favoritesDownloaded = $state(null);
  let postsTotal = $state(null);

  async function refreshDownloadedCount() {
    if (!('caches' in window)) return;
    try {
      const [cache, res] = await Promise.all([
        caches.open('media-cache'),
        fetch('/api/favorites/posts'),
      ]);
      if (!res.ok) return;
      const { posts } = await res.json();
      postsTotal = posts.length;
      const keys = await cache.keys();
      const downloadedPaths = new Set(keys.map((r) => new URL(r.url).pathname));
      favoritesDownloaded = posts.filter((p) =>
        p.media.every((m) => downloadedPaths.has(m.url))
      ).length;
    } catch {
      // silently ignore
    }
  }

  $effect(() => {
    refreshDownloadedCount();
  });

  let downloading = $state(false);
  let downloadTotal = $state(null);
  let downloadDone = $state(0);
  let downloadError = $state(null);

  async function checkForUpdates() {
    updateLoading = true;
    updateStatus = null;
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      }
      window.location.reload();
    } catch {
      updateStatus = 'error';
      updateLoading = false;
    }
  }

  async function downloadAllFavorites() {
    downloading = true;
    downloadTotal = null;
    downloadDone = 0;
    downloadError = null;

    let posts;
    try {
      const res = await fetch('/api/favorites/posts');
      if (!res.ok) throw new Error();
      const { posts: p } = await res.json();
      posts = p;
      downloadTotal = posts.length;
    } catch {
      downloadError = 'Could not load favorites list.';
      downloading = false;
      return;
    }

    if (posts.length === 0) {
      downloading = false;
      return;
    }

    localStorage.setItem('offline-favorites-posts', JSON.stringify(posts));

    const cache = 'caches' in window ? await caches.open('media-cache') : null;
    const BATCH = 3;
    for (const post of posts) {
      const mediaUrls = post.media.map((m) => m.url);
      for (let i = 0; i < mediaUrls.length; i += BATCH) {
        await Promise.allSettled(
          mediaUrls.slice(i, i + BATCH).map(async (url) => {
            if (cache && (await cache.match(url))) return;
            const response = await fetch(url);
            if (cache && response.ok) await cache.put(url, response);
          })
        );
      }
      downloadDone++;
    }

    downloading = false;
    await refreshDownloadedCount();
  }

  let logs = $state([]);
  let logsLoading = $state(false);

  async function fetchLogs() {
    logsLoading = true;
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const json = await res.json();
        logs = json.logs;
      }
    } catch {
      // silently ignore
    } finally {
      logsLoading = false;
    }
  }

  $effect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  });

  const UA_PLACEHOLDER =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/274.0.0.0';

  async function handleSubmit(e) {
    e.preventDefault();
    loading = true;
    error = null;
    try {
      const res = await fetch('/api/settings/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        const json = await res.json();
        username = json.username;
      } else {
        error = 'Authentication failed. Check your session ID.';
      }
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function saveUserAgent(value) {
    uaLoading = true;
    uaError = null;
    uaSaved = false;
    try {
      const res = await fetch('/api/settings/user-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_agent: value }),
      });
      if (res.ok) {
        uaSaved = true;
      } else {
        uaError = 'Failed to save. Please try again.';
      }
    } catch {
      uaError = 'Network error. Please try again.';
    } finally {
      uaLoading = false;
    }
  }

  async function handleUaSubmit(e) {
    e.preventDefault();
    await saveUserAgent(userAgent);
  }

  async function resetUa() {
    userAgent = UA_PLACEHOLDER;
    await saveUserAgent(UA_PLACEHOLDER);
  }

  async function importSavedPosts() {
    importSavedLoading = true;
    importSavedResult = null;
    importSavedError = null;
    try {
      const res = await fetch('/api/settings/import-saved', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        importSavedResult = json.imported;
      } else {
        importSavedError = 'Import failed. Please try again.';
      }
    } catch {
      importSavedError = 'Network error. Please try again.';
    } finally {
      importSavedLoading = false;
    }
  }

  async function importFromDisk() {
    importFromDiskLoading = true;
    importFromDiskResult = null;
    importFromDiskError = null;
    try {
      const res = await fetch('/api/settings/import-from-disk', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        importFromDiskResult = json;
        pendingImports = 0;
      } else if (res.status === 409) {
        importFromDiskError = 'Import already in progress.';
      } else {
        importFromDiskError = 'Import failed. Please try again.';
      }
    } catch {
      importFromDiskError = 'Network error. Please try again.';
    } finally {
      importFromDiskLoading = false;
    }
  }

  async function toggleScheduler() {
    schedulerLoading = true;
    schedulerError = false;
    const action = schedulerRunning ? 'stop' : 'start';
    try {
      const res = await fetch(`/api/settings/scheduler/${action}`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        schedulerRunning = json.running;
        if (!schedulerRunning) {
          nextRunAt = null;
          cycleRunning = false;
        }
      } else {
        schedulerError = true;
      }
    } catch {
      schedulerError = true;
    } finally {
      schedulerLoading = false;
    }
  }
</script>

<div class="page">
  <h1 class="title">Settings</h1>

  <div class="divider"></div>

  <div class="stats-section">
    <span class="field-label">Statistics</span>

    <div class="stats-row">
      <div class="stat">
        <span class="stat-value">{images.toLocaleString('en')}</span>
        <span class="stat-label">photos</span>
      </div>
      <div class="stat">
        <span class="stat-value">{videos.toLocaleString('en')}</span>
        <span class="stat-label">videos</span>
      </div>
      <div class="stat">
        <span class="stat-value">{unrated.toLocaleString('en')}</span>
        <span class="stat-label">unrated</span>
      </div>
      <div class="stat">
        <span class="stat-value">{formatBytes(diskBytes)}</span>
        <span class="stat-label">on server</span>
      </div>
      <div class="stat">
        <span class="stat-value"
          >{cacheBytes !== null ? (cacheBytes > 0 ? formatBytes(cacheBytes) : '0 B') : '–'}</span
        >
        <span class="stat-label">in app</span>
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <form class="form" onsubmit={handleSubmit}>
    <div class="session-header">
      <span class="field-label">Account</span>
      <span class="account-value {username ? '' : 'muted'}"
        >{username ? '@' + username : 'Not connected'}</span
      >
    </div>
    <label class="field-label-secondary" for="session-id">Session ID</label>
    <div class="input-row">
      <div class="input-wrapper">
        <input
          id="session-id"
          class="input"
          type={showSessionId ? 'text' : 'password'}
          bind:value={sessionId}
          placeholder="Paste your session ID"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          class="btn-eye"
          type="button"
          onclick={() => (showSessionId = !showSessionId)}
          aria-label={showSessionId ? 'Hide session ID' : 'Show session ID'}
        >
          {#if showSessionId}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
              />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          {:else}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          {/if}
        </button>
      </div>
      <button class="btn" type="submit" disabled={loading || !sessionId.trim()}>
        {loading ? 'Connecting…' : 'Update'}
      </button>
    </div>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </form>

  {#if false}
    <div class="divider"></div>

    <form class="form" onsubmit={handleUaSubmit}>
      <label class="field-label" for="user-agent">User-Agent</label>
      <input
        id="user-agent"
        class="input"
        type="text"
        bind:value={userAgent}
        placeholder={UA_PLACEHOLDER}
        autocomplete="off"
        spellcheck="false"
      />
      {#if uaError}
        <p class="error">{uaError}</p>
      {/if}
      {#if uaSaved}
        <p class="saved">Saved — applies on next import cycle.</p>
      {/if}
      <div class="btn-row">
        <button class="btn" type="submit" disabled={uaLoading || !userAgent.trim()}>
          {uaLoading ? 'Saving…' : 'Update'}
        </button>
        <button class="btn btn-ghost" type="button" disabled={uaLoading} onclick={resetUa}>
          Reset to default
        </button>
      </div>
    </form>
  {/if}

  <div class="divider"></div>

  <div class="scheduler-section">
    <div class="scheduler-row">
      <div class="scheduler-info">
        <span class="field-label">Scheduler</span>
        {#if schedulerRunning && !cycleRunning && nextRunAt && !isNaN(new Date(nextRunAt).getTime())}
          <span class="label"
            >Next cycle at {new Date(nextRunAt).toLocaleString('en', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}</span
          >
        {:else}
          <span class="label">{schedulerRunning ? 'Running' : 'Stopped'}</span>
        {/if}
        {#if schedulerError}
          <span class="error">Couldn't update scheduler. Please try again.</span>
        {/if}
      </div>
      <Toggle checked={schedulerRunning} disabled={schedulerLoading} onchange={toggleScheduler} />
    </div>
  </div>

  <div class="divider"></div>

  <div class="import-saved-section">
    <span class="field-label">Saved posts</span>
    <span class="label">Import posts you saved on Instagram</span>
    {#if importSavedError}
      <p class="error">{importSavedError}</p>
    {/if}
    {#if importSavedResult !== null}
      <p class="saved">
        {importSavedResult === 0
          ? 'Already up to date.'
          : `${importSavedResult} post${importSavedResult === 1 ? '' : 's'} imported.`}
      </p>
    {/if}
    <button class="btn" type="button" disabled={importSavedLoading} onclick={importSavedPosts}>
      {importSavedLoading ? 'Importing…' : 'Import saved posts'}
    </button>
  </div>

  <div class="divider"></div>

  <div class="import-from-disk-section">
    <span class="field-label">Import from disk</span>
    <span class="label">
      {pendingImports === 1 ? '1 file pending' : pendingImports > 1 ? `${pendingImports} files pending` : 'No files pending'}
    </span>
    {#if importFromDiskError}
      <p class="error">{importFromDiskError}</p>
    {/if}
    {#if importFromDiskResult !== null}
      <p class="saved">
        {#if importFromDiskResult.imported === 0 && importFromDiskResult.duplicates === 0 && importFromDiskResult.warnings === 0}
          Nothing to import.
        {:else}
          {[
            importFromDiskResult.imported ? `${importFromDiskResult.imported} imported` : '',
            importFromDiskResult.duplicates ? `${importFromDiskResult.duplicates} duplicate${importFromDiskResult.duplicates > 1 ? 's' : ''}` : '',
            importFromDiskResult.warnings ? `${importFromDiskResult.warnings} warning${importFromDiskResult.warnings > 1 ? 's' : ''}` : '',
          ].filter(Boolean).join(', ')}.
        {/if}
      </p>
    {/if}
    <button class="btn" type="button" disabled={importFromDiskLoading || pendingImports === 0} onclick={importFromDisk}>
      {importFromDiskLoading ? 'Importing…' : 'Import from disk'}
    </button>
  </div>

  <div class="divider"></div>

  <div class="app-section">
    <span class="field-label">App</span>
    {#if updateStatus === 'error'}
      <p class="error">Update failed. Please refresh manually.</p>
    {/if}
    <button class="btn" type="button" disabled={updateLoading} onclick={checkForUpdates}>
      {updateLoading ? 'Updating…' : 'Check for updates'}
    </button>
  </div>

  <div class="divider"></div>

  <div class="offline-section">
    <span class="field-label">Offline favorites</span>
    <span class="label">
      {#if downloading && downloadTotal !== null}
        {downloadDone} / {downloadTotal} posts
      {:else if favoritesDownloaded !== null && postsTotal !== null}
        {favoritesDownloaded} / {postsTotal} posts
      {/if}
    </span>
    {#if downloadError}
      <p class="error">{downloadError}</p>
    {/if}
    {#if downloading}
      <progress class="download-progress" value={downloadDone} max={downloadTotal ?? 1}></progress>
    {/if}
    <button class="btn" type="button" disabled={downloading} onclick={downloadAllFavorites}>
      {downloading ? 'Downloading…' : 'Download all'}
    </button>
  </div>

  <div class="divider"></div>

  <div class="logs-section">
    <div class="logs-header">
      <span class="field-label">Logs</span>
      <button
        class="btn-refresh"
        type="button"
        disabled={logsLoading}
        onclick={fetchLogs}
        aria-label="Refresh logs"
      >
        ↻
      </button>
    </div>
    <div class="logs-container">
      {#if logs.length === 0}
        <span class="logs-empty">{logsLoading ? 'Loading…' : 'No logs yet.'}</span>
      {:else}
        {#each logs as entry, i (i)}
          <div
            class="log-entry {entry.includes('[ERROR]')
              ? 'log-error'
              : entry.includes('[WARN]')
                ? 'log-warn'
                : ''}"
          >
            {entry}
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .page {
    max-width: 470px;
    margin: 0 auto;
    padding: 32px 20px 16px;
  }

  @media (min-width: 768px) {
    .page {
      max-width: 600px;
    }
  }

  .title {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.3px;
    margin: 0 0 0;
  }

  .session-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .account-value {
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-value.muted {
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .label {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stats-row {
    display: flex;
    gap: 12px 20px;
    flex-wrap: wrap;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.5px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .stat-label {
    font-size: 13px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .input-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }

  .input-wrapper {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .input-wrapper .input {
    width: 100%;
    padding-right: 38px;
  }

  .input-row .btn {
    align-self: auto;
    flex-shrink: 0;
  }

  .btn-eye {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .btn-eye:hover {
    color: var(--color-text);
  }

  .field-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }

  .field-label-secondary {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted);
    margin-top: -4px;
  }

  .input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    font-family: inherit;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    outline: none;
  }

  .input:focus {
    border-color: var(--color-text);
  }

  .error {
    font-size: 13px;
    color: var(--color-error);
    margin: 0;
  }

  .btn {
    align-self: flex-start;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    color: var(--color-bg);
    background: var(--color-text);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn:not(:disabled):active {
    opacity: 0.7;
  }

  @media (hover: hover) and (pointer: fine) {
    .btn:not(:disabled):hover {
      opacity: 0.8;
    }
  }

  .btn-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-ghost {
    background: transparent;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
  }

  .divider {
    border-top: 1px solid var(--color-border);
    margin: 24px 0;
  }

  .saved {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0;
  }

  .stats-section,
  .scheduler-section,
  .import-saved-section,
  .app-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .scheduler-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .scheduler-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .logs-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .logs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-refresh {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 18px;
    color: var(--color-text-muted);
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s;
  }

  .btn-refresh:not(:disabled):hover {
    color: var(--color-text);
  }

  .btn-refresh:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .logs-container {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 12px;
    max-height: 320px;
    overflow-y: auto;
    font-family: ui-monospace, 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.6;
  }

  .logs-empty {
    color: var(--color-text-muted);
  }

  .log-entry {
    color: var(--color-text);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .log-entry.log-warn {
    color: #b58a00;
  }

  .log-entry.log-error {
    color: var(--color-error);
  }

  .import-from-disk-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .offline-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .download-progress {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    appearance: none;
    border: none;
    background: var(--color-border);
    overflow: hidden;
  }

  .download-progress::-webkit-progress-bar {
    background: var(--color-border);
    border-radius: 2px;
  }

  .download-progress::-webkit-progress-value {
    background: var(--color-text);
    border-radius: 2px;
    transition: width 0.2s ease;
  }

  .download-progress::-moz-progress-bar {
    background: var(--color-text);
    border-radius: 2px;
  }
</style>
