<script>
  import PostCard from '$lib/PostCard.svelte';

  const CACHE_KEY = 'cache_feed_v1';
  const SORT_KEY = 'feed_sort_v1';

  let { data } = $props();
  let posts = $state(data.posts);
  let sort = $state(data.sort ?? 'post_timestamp');
  let loading = $state(false);

  async function setSort(newSort) {
    if (newSort === sort || loading) return;
    sort = newSort;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SORT_KEY, newSort);
    }
    loading = true;
    try {
      const res = await fetch(`/api/feed?sort=${newSort}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      posts = Array.isArray(json?.posts) ? json.posts : [];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify(posts));
      }
    } catch {
      // keep current posts on error
    } finally {
      loading = false;
    }
  }
</script>

<div class="page">
  <div class="header">
    <h1 class="title">Feed</h1>
    <div class="sort-control" role="group" aria-label="Sort order">
      <button
        class="sort-btn"
        class:active={sort === 'post_timestamp'}
        onclick={() => setSort('post_timestamp')}
      >
        Published
      </button>
      <button
        class="sort-btn"
        class:active={sort === 'imported_at'}
        onclick={() => setSort('imported_at')}
      >
        Imported
      </button>
    </div>
  </div>

  {#if posts.length === 0}
    <div class="empty">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M3 9l9-7 9 7v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linejoin="round"
        />
        <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" />
      </svg>
      <p class="empty-title">Nothing here yet</p>
      <p class="empty-sub">Start the scheduler to import posts from accounts you follow.</p>
    </div>
  {:else}
    <div class="feed" class:loading>
      {#each posts as post (post.shortcode ?? `${post.account}/${post.post_timestamp ?? post.media[0]?.url}`)}
        <PostCard {post} />
      {/each}
    </div>
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
    padding: 8px 16px 16px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .title {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.3px;
    margin: 0;
  }

  .sort-control {
    display: flex;
    gap: 2px;
    background: var(--color-border-subtle);
    border-radius: 8px;
    padding: 2px;
    flex-shrink: 0;
  }

  .sort-btn {
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-text-muted);
    background: transparent;
    transition:
      background 0.15s,
      color 0.15s;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }

  .sort-btn.active {
    background: var(--color-bg);
    color: var(--color-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .feed {
    transition: opacity 0.15s;
  }

  .feed.loading {
    opacity: 0.5;
    pointer-events: none;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: calc(100dvh - 49px - env(safe-area-inset-bottom, 0px));
    padding: 32px;
    text-align: center;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--color-empty-icon);
  }

  .empty-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text);
  }

  .empty-sub {
    font-size: 14px;
    color: var(--color-text-muted);
    max-width: 260px;
  }
</style>
