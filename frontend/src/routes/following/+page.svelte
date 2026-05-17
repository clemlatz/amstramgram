<script>
  let { data } = $props();

  const AVATAR_COLORS = ['#e91e63', '#9c27b0', '#2196f3', '#00bcd4', '#ff5722', '#ff9800'];

  function avatarColor(account) {
    let h = 0;
    for (const c of account) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function hideAvatarImage(e) {
    e.target.style.display = 'none';
  }

  let syncLoading = $state(false);
  let syncResult = $state(null);
  let syncError = $state(null);

  async function syncFollowing() {
    syncLoading = true;
    syncError = null;
    try {
      const res = await fetch('/api/accounts/sync-following', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        syncResult = json.added;
      } else {
        syncError = 'Sync failed. Please try again.';
      }
    } catch {
      syncError = 'Network error. Please try again.';
    } finally {
      syncLoading = false;
    }
  }
</script>

<div class="page">
  <div class="header">
    <h1 class="title">Following</h1>
    <div class="sync">
      {#if syncResult !== null}
        <span class="sync-label">{syncResult === 0 ? 'Already up to date' : `${syncResult} new account${syncResult === 1 ? '' : 's'} added`}</span>
      {/if}
      {#if syncError}
        <span class="sync-label error">{syncError}</span>
      {/if}
      <button class="btn" type="button" disabled={syncLoading} onclick={syncFollowing}>
        {syncLoading ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  </div>

  {#if data.accounts.length === 0}
    <p class="empty">No accounts yet.</p>
  {:else}
    <ul class="list">
      {#each data.accounts as account}
        <li class="row">
          <div class="avatar-wrap">
            <img
              class="avatar-img"
              src="/api/accounts/{account.username}/avatar"
              alt={account.username}
              onerror={hideAvatarImage}
            />
            <div class="avatar" style="background:{avatarColor(account.username)}">
              {(account.username?.[0] ?? '').toUpperCase()}
            </div>
          </div>
          <div class="info">
            <a class="username" href="https://www.instagram.com/{account.username}" target="_blank">
              {account.username}
            </a>
            <span class="count">{account.count.toLocaleString('en')} posts</span>
          </div>
          <label class="toggle">
            <input type="checkbox" checked={account.active} disabled />
            <span class="track"></span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page {
    max-width: 470px;
    margin: 0 auto;
    padding: 16px 0;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px 16px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 8px;
  }

  .title {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.3px;
    margin: 0;
  }

  .sync {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .sync-label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .sync-label.error {
    color: #e03131;
  }

  .btn {
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    color: var(--color-bg);
    background: var(--color-text);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn:not(:disabled):active {
    opacity: 0.7;
  }

  .empty {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 14px;
    padding: 48px 20px;
  }

  .list {
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
  }

  .avatar-wrap {
    flex-shrink: 0;
    position: relative;
    width: 44px;
    height: 44px;
  }

  .avatar-img {
    position: absolute;
    inset: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    z-index: 1;
  }

  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .username {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-decoration: none;
  }

  .count {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  /* iOS-style toggle */
  .toggle {
    flex-shrink: 0;
    position: relative;
    width: 51px;
    height: 31px;
    cursor: default;
  }

  .toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
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
