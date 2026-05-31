<script>
  import Avatar from '$lib/Avatar.svelte';
  let { data } = $props();

  let accounts = $state(data.accounts);

  let activeAccounts = $derived(accounts.filter((a) => a.active && !a.hidden));
  let inactiveAccounts = $derived(accounts.filter((a) => !a.active && !a.hidden));

  async function toggleFollow(username, currentActive) {
    const newActive = !currentActive;
    const idx = accounts.findIndex((a) => a.username === username);
    if (idx === -1) return;
    accounts[idx] = { ...accounts[idx], active: newActive };
    try {
      const res = await fetch(`/api/accounts/${username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      accounts[idx] = { ...accounts[idx], active: currentActive };
    }
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

  let openPreviews = $state(new Set());
  let previewCache = $state({});
  let previewLoading = $state(new Set());

  async function togglePreview(username) {
    if (openPreviews.has(username)) {
      openPreviews = new Set([...openPreviews].filter((u) => u !== username));
      return;
    }
    openPreviews = new Set([username]);
    if (previewCache[username] || previewLoading.has(username)) return;
    previewLoading = new Set([...previewLoading, username]);
    try {
      const res = await fetch(`/api/accounts/${username}/preview`);
      if (res.ok) {
        const json = await res.json();
        previewCache = { ...previewCache, [username]: json.media };
      }
    } catch {
      // network error — leave uncached so next open retries
    } finally {
      previewLoading = new Set([...previewLoading].filter((u) => u !== username));
    }
  }
</script>

{#snippet accountItem(account)}
  <li class="item">
    <div class="row">
      <Avatar
        account={account.username}
        active={account.active}
        ontoggle={() => toggleFollow(account.username, account.active)}
      />
      <div class="info">
        <a
          class="username"
          id="account-{account.username}"
          href="/accounts/{account.username}"
        >
          {account.username}
        </a>
        <span class="count">
          {account.count.toLocaleString('en')} posts
          {#if account.favorited_count > 0}
            {@const rated = account.favorited_count + account.archived_count}
            <span class="ratings">
              ·
              {Math.round((account.favorited_count / rated) * 100)} %
            </span>
          {/if}
        </span>
      </div>
      <button
        class="preview-btn"
        class:active={openPreviews.has(account.username)}
        type="button"
        title="Preview posts"
        onclick={() => togglePreview(account.username)}
        aria-expanded={openPreviews.has(account.username)}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <rect x="2" y="2" width="7" height="7" rx="1" />
          <rect x="11" y="2" width="7" height="7" rx="1" />
          <rect x="2" y="11" width="7" height="7" rx="1" />
          <rect x="11" y="11" width="7" height="7" rx="1" />
        </svg>
      </button>
      <div class="status-icons" aria-hidden="true">
        <span
          class="status-icon"
          class:on={!account.hidden}
          title={account.hidden ? 'Hidden' : 'Visible'}
        >
          {#if account.hidden}
            <!-- eye-off -->
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
                clip-rule="evenodd"
              />
              <path
                d="M10.748 13.93l2.523 2.524a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z"
              />
            </svg>
          {:else}
            <!-- eye -->
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path
                fill-rule="evenodd"
                d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z"
                clip-rule="evenodd"
              />
            </svg>
          {/if}
        </span>
      </div>
    </div>
    {#if openPreviews.has(account.username)}
      <div class="preview-strip">
        {#if previewLoading.has(account.username)}
          {#each [0, 1, 2, 3, 4] as i (i)}
            <div class="preview-thumb skeleton"></div>
          {/each}
        {:else if previewCache[account.username]?.length}
          {#each previewCache[account.username] as item (item.url)}
            <a
              href={item.shortcode
                ? `/accounts/${account.username}/${item.shortcode}`
                : `/accounts/${account.username}`}
              class="preview-thumb"
            >
              {#if item.type === 'image'}
                <img src={item.url} alt="" loading="lazy" />
              {:else}
                <div class="preview-video">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
                    />
                  </svg>
                </div>
              {/if}
            </a>
          {/each}
        {:else}
          <p class="preview-empty">No posts</p>
        {/if}
      </div>
    {/if}
  </li>
{/snippet}

<div class="page">
  <div class="header">
    <h1 class="title">Following</h1>
    <div class="sync">
      {#if syncResult !== null}
        <span class="sync-label"
          >{syncResult === 0
            ? 'Already up to date'
            : `${syncResult} new account${syncResult === 1 ? '' : 's'} added`}</span
        >
      {/if}
      {#if syncError}
        <span class="sync-label error">{syncError}</span>
      {/if}
      <button class="btn" type="button" disabled={syncLoading} onclick={syncFollowing}>
        {syncLoading ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  </div>

  {#if accounts.length === 0}
    <p class="empty">No accounts yet.</p>
  {:else}
    <section class="group">
      <h2 class="group-title">Active ({activeAccounts.length})</h2>
      {#if activeAccounts.length === 0}
        <p class="group-empty">No active accounts.</p>
      {:else}
        <ul class="list">
          {#each activeAccounts as account (account.username)}
            {@render accountItem(account)}
          {/each}
        </ul>
      {/if}
    </section>

    <section class="group">
      <h2 class="group-title">Inactive ({inactiveAccounts.length})</h2>
      {#if inactiveAccounts.length === 0}
        <p class="group-empty">No inactive accounts.</p>
      {:else}
        <ul class="list">
          {#each inactiveAccounts as account (account.username)}
            {@render accountItem(account)}
          {/each}
        </ul>
      {/if}
    </section>
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

  .group-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--color-text-muted);
    padding: 12px 16px 6px;
    border-bottom: 1px solid var(--color-border);
    margin: 0;
  }

  .group-empty {
    font-size: 13px;
    color: var(--color-text-muted);
    padding: 12px 16px;
    margin: 0;
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

  .ratings {
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .status-icons {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .status-icon {
    display: flex;
    align-items: center;
    color: var(--color-text-muted);
  }

  .status-icon.on {
    color: #34c759;
    opacity: 0.5;
  }

  .status-icon svg {
    width: 20px;
    height: 20px;
  }

  .preview-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    border-radius: 4px;
    flex-shrink: 0;
    transition: color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .preview-btn svg {
    width: 18px;
    height: 18px;
  }

  .preview-btn.active {
    color: var(--color-text);
  }

  @media (hover: hover) and (pointer: fine) {
    .preview-btn:hover {
      color: var(--color-text);
    }
  }

  .preview-strip {
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 0 16px 10px 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .preview-strip::-webkit-scrollbar {
    display: none;
  }

  .preview-thumb {
    flex-shrink: 0;
    width: 96px;
    height: 128px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--color-border);
    display: block;
    text-decoration: none;
  }

  .preview-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .preview-video {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-muted, #2a2a2a);
    color: var(--color-text-muted);
  }

  .preview-video svg {
    width: 24px;
    height: 24px;
  }

  .skeleton {
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  .preview-empty {
    font-size: 13px;
    color: var(--color-text-muted);
    padding: 0;
    margin: 0;
    align-self: center;
  }
</style>
