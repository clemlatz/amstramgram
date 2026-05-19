<script>
  import Avatar from '$lib/Avatar.svelte';

  let { data } = $props();
  const { profile, posts } = data;

  let active = $state(profile?.active ?? true);

  function displayUrl(url) {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  async function toggleActive() {
    const next = !active;
    active = next;
    try {
      await fetch(`/api/accounts/${profile.username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
    } catch {
      active = !next;
    }
  }
</script>

<div class="page">
  {#if !profile}
    <div class="not-found">Account not found.</div>
  {:else}
    <div class="profile-header">
      <div class="profile-top">
        <Avatar account={profile.username} active={active} size={80} />
        <div class="profile-stats">
          <h1 class="profile-username">{profile.username}</h1>
          <p class="profile-counts">
            {(profile.post_count ?? 0).toLocaleString('en')} posts
            {#if profile.unrated_count > 0}
              · {(profile.unrated_count ?? 0).toLocaleString('en')} unrated
            {/if}
          </p>
          {#if profile.favorited_count > 0}
            <p class="profile-fav">
              {Math.round(profile.favorited_count / (profile.favorited_count + profile.archived_count) * 100)}% favorited
            </p>
          {/if}
        </div>
      </div>

      {#if profile.full_name || profile.bio || profile.external_url}
        <div class="profile-bio">
          {#if profile.full_name}
            <p class="profile-full-name">{profile.full_name}</p>
          {/if}
          {#if profile.bio}
            <p class="profile-bio-text">{profile.bio}</p>
          {/if}
          {#if profile.external_url}
            <a
              href={profile.external_url}
              target="_blank"
              rel="noopener noreferrer"
              class="profile-url"
            >
              {displayUrl(profile.external_url)}
            </a>
          {/if}
        </div>
      {/if}

      <div class="profile-actions">
        <a
          href="https://www.instagram.com/{profile.username}"
          target="_blank"
          rel="noopener noreferrer"
          class="profile-action-btn"
        >
          View on Instagram ↗
        </a>
        <button
          class="profile-action-btn"
          class:inactive={!active}
          onclick={toggleActive}
        >
          {active ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>

    {#if posts.length === 0}
      <p class="empty">No posts downloaded yet.</p>
    {:else}
      <div class="grid">
        {#each posts as post (post.shortcode ?? post.post_timestamp)}
          <div class="grid-cell">
            {#if post.media[0]?.type === 'video'}
              <video src={post.media[0].url} muted playsinline preload="none"></video>
            {:else}
              <img src={post.media[0]?.url} alt="" loading="lazy" />
            {/if}
            {#if post.media?.length > 1}
              <span class="carousel-indicator" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="7" width="13" height="13" rx="2" stroke="white" stroke-width="1.5"/>
                  <path d="M5 5V4a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 470px;
    margin: 0 auto;
  }

  @media (min-width: 768px) {
    .page {
      max-width: 600px;
    }
  }

  .not-found {
    padding: 48px 20px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 14px;
  }

  /* Header */
  .profile-header {
    padding: 20px 16px 0;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 2px;
  }

  .profile-top {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 16px;
  }

  .profile-stats {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .profile-username {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-counts {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .profile-fav {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .profile-bio {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
  }

  .profile-full-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
  }

  .profile-bio-text {
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.5;
    white-space: pre-line;
  }

  .profile-url {
    font-size: 14px;
    font-weight: 600;
    color: #00376b;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }

  @media (prefers-color-scheme: dark) {
    .profile-url {
      color: #e0f1ff;
    }
  }

  .profile-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .profile-action-btn {
    flex: 1;
    display: block;
    text-align: center;
    padding: 7px 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    text-decoration: none;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
  }

  .profile-action-btn.inactive {
    color: var(--color-text-muted);
    border-color: var(--color-border);
  }

  @media (hover: hover) and (pointer: fine) {
    .profile-action-btn:hover {
      background: var(--color-border-subtle);
    }
  }

  /* Grid */
  .empty {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 14px;
    padding: 48px 20px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }

  .grid-cell {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    background: var(--color-border-subtle);
  }

  .grid-cell img,
  .grid-cell video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .carousel-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    pointer-events: none;
  }

  .carousel-indicator svg {
    width: 16px;
    height: 16px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }
</style>
