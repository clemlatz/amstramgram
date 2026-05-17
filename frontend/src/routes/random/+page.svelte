<script>
  import 'swiper/css';
  import 'swiper/css/pagination';
  import Avatar from '$lib/Avatar.svelte';
  import { formatDate } from '$lib/media.js';

  const MODE_KEY = 'random-mode';

  let { data } = $props();

  let post = $state(data.post);
  let loading = $state(false);
  let visible = $state(true);
  let muted = $state(true);
  let swiperEl = $state(null);
  let fetchError = $state(data.loadError ?? false);
  let mode = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)) || 'all'
  );

  const isCarousel = $derived(post?.media?.length > 1);

  $effect(() => {
    if (!swiperEl) return;

    let destroyed = false;
    let instance = null;

    (async () => {
      try {
        const { default: Swiper } = await import('swiper');
        const { Pagination, Navigation } = await import('swiper/modules');
        if (destroyed) return;
        instance = new Swiper(swiperEl, {
          modules: [Pagination, Navigation],
          pagination: { el: swiperEl.querySelector('.swiper-pagination'), clickable: false },
          navigation: {
            nextEl: swiperEl.querySelector('.nav-next'),
            prevEl: swiperEl.querySelector('.nav-prev'),
          },
        });
      } catch {
        // carousel falls back to static image display
      }
    })();

    return () => {
      destroyed = true;
      instance?.destroy();
    };
  });

  function togglePlayPause(e) {
    const video = e.currentTarget;
    video.paused ? video.play().catch(() => {}) : video.pause();
  }

  function toggleMute(e) {
    e.stopPropagation();
    muted = !muted;
  }

  async function switchMode(newMode) {
    if (newMode === mode) return;
    mode = newMode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODE_KEY, mode);
    }
    post = null;
    loading = true;
    await loadNext();
  }

  async function rate(action) {
    if (!post || loading) return;
    loading = true;
    visible = false;
    fetchError = false;

    const shortcode = post.shortcode;

    try {
      await Promise.all([
        new Promise(r => setTimeout(r, 200)),
        fetch('/api/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shortcode, action }),
        }),
      ]);
    } catch {
      // rating request failed — continue to next post anyway
    }

    await loadNext();
  }

  async function skip() {
    if (!post || loading) return;
    loading = true;
    visible = false;
    fetchError = false;
    await loadNext();
  }

  async function loadNext() {
    try {
      const endpoint = mode === 'favorites' ? '/api/random/favorites' : '/api/random';
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error();
      const { post: next } = await res.json();
      post = next;
      muted = true;
    } catch {
      post = null;
      fetchError = true;
    }
    visible = true;
    loading = false;
  }

  async function retryFetch() {
    fetchError = false;
    loading = true;
    await loadNext();
  }
</script>

{#snippet muteIcon()}
  {#if muted}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/>
      <line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  {/if}
{/snippet}

{#if post}
  <div class="page">
    <div class="mode-toggle">
      <button class="mode-btn" class:active={mode === 'all'} onclick={() => switchMode('all')}>All</button>
      <button class="mode-btn" class:active={mode === 'favorites'} onclick={() => switchMode('favorites')}>Favorites</button>
    </div>

    <article class="card" class:fade={!visible}>
      <header class="post-header">
        <Avatar account={post.account} active={post.account_active ?? true} />
        <div class="post-meta">
          <div class="post-account">
            <a href="https://www.instagram.com/{post.account}" target="_blank" rel="noopener noreferrer">
              {post.account}
            </a>
          </div>
          <div class="post-date">{formatDate(post.post_timestamp)}</div>
        </div>
      </header>

      {#key post.shortcode}
        {#if isCarousel}
          <div class="swiper" bind:this={swiperEl}>
            <div class="swiper-wrapper">
              {#each post.media as item}
                <div class="swiper-slide">
                  {#if item.type === 'video'}
                    <div class="video-wrapper">
                      <video src={item.url} loop bind:muted={muted} playsinline autoplay onclick={togglePlayPause}></video>
                      <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                        {@render muteIcon()}
                      </button>
                    </div>
                  {:else}
                    <img src={item.url} alt="" loading="lazy" />
                  {/if}
                </div>
              {/each}
            </div>
            <div class="swiper-pagination"></div>
            <button class="nav-btn nav-prev" aria-label="Previous">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button class="nav-btn nav-next" aria-label="Next">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        {:else if post.media[0]?.type === 'video'}
          <div class="video-wrapper">
            <video class="post-video" src={post.media[0].url} loop bind:muted={muted} playsinline autoplay onclick={togglePlayPause}></video>
            <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              {@render muteIcon()}
            </button>
          </div>
        {:else}
          <img class="post-image" src={post.media[0]?.url} alt="" />
        {/if}
      {/key}
    </article>

    <div class="actions">
      {#if mode === 'favorites'}
        <button class="btn forget" disabled={loading} onclick={() => rate('archive')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Forget
        </button>
        <button class="btn next" disabled={loading} onclick={skip}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          Next
        </button>
      {:else}
        <button class="btn forget" disabled={loading} onclick={() => rate('archive')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Forget
        </button>
        <button class="btn remember" disabled={loading} onclick={() => rate('favorite')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          Remember
        </button>
      {/if}
    </div>
  </div>
{:else if fetchError}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/>
      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="16" r="1" fill="currentColor"/>
    </svg>
    <p class="empty-title">Connection error</p>
    <p class="empty-sub">Couldn't load the next post.</p>
    <button class="retry-btn" onclick={retryFetch}>Try again</button>
  </div>
{:else if mode === 'favorites'}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <p class="empty-title">No favorites yet</p>
    <p class="empty-sub">Posts you remember will appear here.</p>
    <button class="retry-btn" onclick={() => switchMode('all')}>Browse all posts</button>
  </div>
{:else}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.75"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
      <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/>
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/>
    </svg>
    <p class="empty-title">All caught up!</p>
    <p class="empty-sub">Come back later for new posts.</p>
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    max-width: 470px;
    margin: 0 auto;
    padding: 16px 0 0;
    gap: 16px;
  }

  @media (min-width: 768px) {
    .page {
      max-width: 600px;
    }
  }

  .mode-toggle {
    display: flex;
    background: var(--color-border-subtle);
    border-radius: 8px;
    padding: 3px;
    align-self: center;
  }

  .mode-btn {
    flex: 1;
    padding: 6px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    background: transparent;
    color: var(--color-text-muted);
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .mode-btn.active {
    background: var(--color-bg);
    color: var(--color-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  .next { background: var(--color-action-next, #5a6472); }

  .card {
    transition: opacity 0.2s ease;
  }

  .card.fade {
    opacity: 0;
  }

  .post-header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    gap: 10px;
  }

  .post-meta {
    flex: 1;
    min-width: 0;
  }

  .post-account a {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.2;
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .post-date {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 1px;
  }

  .post-image {
    width: 100%;
    display: block;
  }

  /* Video */
  .video-wrapper {
    position: relative;
  }

  .post-video {
    width: 100%;
    display: block;
    cursor: pointer;
  }

  .mute-btn {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    z-index: 10;
  }

  .mute-btn::before {
    content: '';
    position: absolute;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
  }

  .mute-btn svg {
    width: 16px;
    height: 16px;
    stroke: #fff;
    position: relative;
    z-index: 1;
  }

  /* Carousel */
  .swiper {
    position: relative;
    overflow: hidden;
  }

  .swiper :global(.swiper-slide img) {
    width: 100%;
    display: block;
  }

  .swiper :global(.swiper-slide video) {
    width: 100%;
    display: block;
    cursor: pointer;
  }

  .swiper :global(.swiper-pagination) {
    position: absolute;
    bottom: 12px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    pointer-events: none;
    z-index: 10;
  }

  .swiper :global(.swiper-pagination-bullet) {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fff;
    opacity: 0.5;
    margin: 0 !important;
    transition: opacity 0.2s;
    display: inline-block;
  }

  .swiper :global(.swiper-pagination-bullet-active) {
    opacity: 1;
  }

  .nav-btn {
    display: none;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--color-nav-btn);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.22);
    border: none;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    color: var(--color-nav-btn-text);
    padding: 0;
  }

  .nav-btn svg {
    width: 14px;
    height: 14px;
  }

  .nav-prev { left: 8px; }
  .nav-next { right: 8px; }

  @media (hover: hover) and (pointer: fine) {
    .swiper:hover .nav-btn:not(.swiper-button-disabled) {
      display: flex;
    }
  }

  .actions {
    display: flex;
    gap: 12px;
    padding: 0 16px 16px;
    flex-shrink: 0;
  }

  .btn {
    flex: 1;
    height: 56px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.15s, transform 0.1s;
  }

  .btn:active {
    transform: scale(0.96);
    opacity: 0.85;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: default;
    transform: none;
  }

  .btn svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .forget { background: var(--color-action-forget); }
  .remember { background: var(--color-action-remember); }

  @media (hover: hover) and (pointer: fine) {
    .btn:not(:disabled):hover {
      opacity: 0.88;
    }
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
  }

  .retry-btn {
    margin-top: 4px;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    color: var(--color-bg);
    background: var(--color-text);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .retry-btn:active {
    opacity: 0.7;
  }

  @media (hover: hover) and (pointer: fine) {
    .retry-btn:hover {
      opacity: 0.8;
    }
  }
</style>
