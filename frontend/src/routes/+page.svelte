<script>
  import PostCard from '$lib/PostCard.svelte';
  let { data } = $props();
</script>

<div class="page">
  <div class="header">
    <h1 class="title">Feed</h1>
  </div>

{#if data.posts.length === 0}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9l9-7 9 7v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>
      <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>
    </svg>
    <p class="empty-title">Nothing here yet</p>
    <p class="empty-sub">Start the scheduler to download posts from accounts you follow.</p>
  </div>
{:else}
  <div class="feed">
    {#each data.posts as post (post.shortcode)}
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
  }

  .title {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.3px;
    margin: 0;
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
