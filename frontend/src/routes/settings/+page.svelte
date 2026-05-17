<script>
  let { data } = $props();

  let username = $state(data.username);
  let sessionId = $state(data.session_id ?? '');
  let total = $state(data.total ?? 0);
  let diskBytes = $state(data.diskBytes ?? 0);

  function formatBytes(bytes) {
    if (!bytes) return '–';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
  }
  let loading = $state(false);
  let error = $state(null);

  let userAgent = $state(data.user_agent ?? '');
  let uaLoading = $state(false);
  let uaError = $state(null);
  let uaSaved = $state(false);

  let schedulerRunning = $state(data.scheduler_running ?? false);
  let nextRunAt = $state(data.next_run_at ?? null);
  let schedulerLoading = $state(false);
  let schedulerError = $state(false);

  let syncSavedLoading = $state(false);
  let syncSavedResult = $state(null);
  let syncSavedError = $state(null);

  const UA_PLACEHOLDER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/274.0.0.0';

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

  async function syncSavedPosts() {
    syncSavedLoading = true;
    syncSavedResult = null;
    syncSavedError = null;
    try {
      const res = await fetch('/api/settings/sync-saved', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        syncSavedResult = json.downloaded;
      } else {
        syncSavedError = 'Sync failed. Please try again.';
      }
    } catch {
      syncSavedError = 'Network error. Please try again.';
    } finally {
      syncSavedLoading = false;
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
        if (!schedulerRunning) nextRunAt = null;
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

  <div class="account-section">
    <span class="field-label">Account</span>
    <span class="account-value {username ? '' : 'muted'}">{username ? '@' + username : 'Not connected'}</span>
  </div>

  <div class="divider"></div>

  <div class="stats-row">
    <div class="stat">
      <span class="stat-value">{total.toLocaleString('en')}</span>
      <span class="stat-label">media</span>
    </div>
    <div class="stat">
      <span class="stat-value">{formatBytes(diskBytes)}</span>
      <span class="stat-label">on disk</span>
    </div>
  </div>

  <div class="divider"></div>

  <form class="form" onsubmit={handleSubmit}>
    <label class="field-label" for="session-id">Session ID</label>
    <input
      id="session-id"
      class="input"
      type="password"
      bind:value={sessionId}
      placeholder="Paste your session ID"
      autocomplete="off"
      spellcheck="false"
    />
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <button class="btn" type="submit" disabled={loading || !sessionId.trim()}>
      {loading ? 'Connecting…' : 'Update'}
    </button>
  </form>

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
      <p class="saved">Saved — applies on next download cycle.</p>
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

  <div class="divider"></div>

  <div class="scheduler-section">
    <div class="scheduler-row">
      <div class="scheduler-info">
        <span class="field-label">Scheduler</span>
        {#if schedulerRunning && nextRunAt}
          <span class="label">Next cycle at {new Date(nextRunAt).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        {:else}
          <span class="label">{schedulerRunning ? 'Running' : 'Stopped'}</span>
        {/if}
        {#if schedulerError}
          <span class="error">Couldn't update scheduler. Please try again.</span>
        {/if}
      </div>
      <label class="toggle">
        <input type="checkbox" checked={schedulerRunning} disabled={schedulerLoading} onchange={toggleScheduler} />
        <span class="track"></span>
      </label>
    </div>
  </div>

  <div class="divider"></div>

  <div class="sync-saved-section">
    <span class="field-label">Saved posts</span>
    <span class="label">Download posts you saved on Instagram</span>
    {#if syncSavedError}
      <p class="error">{syncSavedError}</p>
    {/if}
    {#if syncSavedResult !== null}
      <p class="saved">{syncSavedResult === 0 ? 'Already up to date.' : `${syncSavedResult} post${syncSavedResult === 1 ? '' : 's'} downloaded.`}</p>
    {/if}
    <button class="btn" type="button" disabled={syncSavedLoading} onclick={syncSavedPosts}>
      {syncSavedLoading ? 'Syncing…' : 'Sync saved posts'}
    </button>
  </div>

</div>

<style>
  .page {
    max-width: 470px;
    margin: 0 auto;
    padding: 32px 20px 16px;
  }

  .title {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.3px;
    margin: 0 0 0;
  }

  .account-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .account-value {
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text);
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
    gap: 32px;
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

  .field-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
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
    color: #e03131;
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

  .scheduler-section,
  .sync-saved-section {
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

  /* iOS-style toggle */
  .toggle {
    flex-shrink: 0;
    position: relative;
    width: 51px;
    height: 31px;
    cursor: pointer;
  }

  .toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle input:disabled ~ .track {
    opacity: 0.4;
    cursor: default;
  }

  .track {
    display: block;
    width: 51px;
    height: 31px;
    border-radius: 16px;
    background: #e5e5ea;
    transition: background 0.2s;
    position: relative;
  }

  .track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.25);
    transition: transform 0.2s;
  }

  .toggle input:checked ~ .track {
    background: #34c759;
  }

  .toggle input:checked ~ .track::after {
    transform: translateX(20px);
  }

  @media (prefers-color-scheme: dark) {
    .track {
      background: #3a3a3c;
    }
  }
</style>
