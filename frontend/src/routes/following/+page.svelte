<script>
  import Toggle from '$lib/Toggle.svelte';
  import Avatar from '$lib/Avatar.svelte';
  let { data } = $props();

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
          <Avatar account={account.username} active={account.active} />
          <div class="info">
            <a class="username" id="account-{account.username}" href="https://www.instagram.com/{account.username}" target="_blank" rel="noopener noreferrer">
              {account.username}
            </a>
            <span class="count">{account.count.toLocaleString('en')} posts</span>
          </div>
          <Toggle checked={account.active} disabled label="Active" describedby="account-{account.username}" />
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

  @media (min-width: 768px) {
    .page {
      max-width: 600px;
    }
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
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sync {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    min-width: 0;
  }

  .sync-label {
    font-size: 12px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
  }

  .sync-label.error {
    color: var(--color-error);
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

  @media (hover: hover) and (pointer: fine) {
    .btn:not(:disabled):hover {
      opacity: 0.8;
    }
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

</style>
