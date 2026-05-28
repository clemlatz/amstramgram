<script>
  import 'swiper/css';
  import 'swiper/css/pagination';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Avatar from '$lib/Avatar.svelte';
  import { formatDate } from '$lib/media.js';
  import { audio } from '$lib/audio.svelte.js';
  import { offline } from '$lib/offline.svelte.js';

  let { data } = $props();

  const { posts } = data;
  const post = $derived(data.post);
  const username = $derived($page.params.username);

  const currentIndex = $derived(posts.findIndex((p) => p.shortcode === post?.shortcode));
  const prevPost = $derived(currentIndex > 0 ? posts[currentIndex - 1] : null);
  const nextPost = $derived(
    currentIndex >= 0 && currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null
  );

  let rating = $state(null);
  let ratingLoading = $state(false);
  let swiperEl = $state(null);
  let accountActive = $state(post?.account_active ?? true);

  const isCarousel = $derived((post?.media?.length ?? 0) > 1);

  $effect(() => {
    void post?.shortcode;
    rating = post?.favorited_at ? 'favorite' : post?.archived_at ? 'archive' : null;
    accountActive = post?.account_active ?? true;
  });

  async function toggleAccountActive() {
    const next = !accountActive;
    accountActive = next;
    try {
      await fetch(`/api/accounts/${username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
    } catch {
      accountActive = !next;
    }
  }

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
        // swiper unavailable
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
    audio.muted = !audio.muted;
  }

  function revealFirstFrame(e) {
    e.currentTarget.currentTime = 0.001;
  }

  async function rate(action) {
    if (!post || ratingLoading || offline.value) return;
    ratingLoading = true;
    const effectiveAction = rating === action ? 'clear' : action;
    try {
      await fetch('/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcode: post.shortcode, action: effectiveAction }),
      });
      rating = effectiveAction === 'clear' ? null : action;

      if (typeof localStorage !== 'undefined') {
        const cacheKey = `cache_account_${username}_v1`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            if (Array.isArray(data?.posts)) {
              const idx = data.posts.findIndex((p) => p.shortcode === post.shortcode);
              if (idx !== -1) {
                const now = new Date().toISOString();
                data.posts[idx] = {
                  ...data.posts[idx],
                  favorited_at: effectiveAction === 'favorite' ? now : null,
                  archived_at: effectiveAction === 'archive' ? now : null,
                };
                localStorage.setItem(cacheKey, JSON.stringify(data));
              }
            }
          } catch {
            // cache update failed, ignored
          }
        }
      }
    } catch {
      // rating request failed
    }
    ratingLoading = false;
  }
</script>

{#snippet muteIcon()}
  {#if audio.muted}
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  {:else}
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  {/if}
{/snippet}

{#if data.notFound}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75" />
      <line
        x1="12"
        y1="8"
        x2="12"
        y2="12"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
    <p class="empty-title">Post not found</p>
    <a class="retry-btn" href="/accounts/{username}">Back to account</a>
  </div>
{:else if !post}
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75" />
      <line
        x1="12"
        y1="8"
        x2="12"
        y2="12"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
    <p class="empty-title">Connection error</p>
    <p class="empty-sub">Couldn't load this post.</p>
    <a class="retry-btn" href="/accounts/{username}">Back to account</a>
  </div>
{:else}
  <div class="page">
    <article class="card">
      <header class="post-header">
        <Avatar account={post.account} active={accountActive} ontoggle={toggleAccountActive} />
        <div class="post-meta">
          <div class="post-account">
            <a href="/accounts/{post.account}">{post.account}</a>
          </div>
          <div class="post-date">{formatDate(post.post_timestamp)}</div>
        </div>
        <a href="/accounts/{username}" class="back-btn" aria-label="Back to account">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </a>
      </header>

      {#key post.shortcode}
        {#if isCarousel}
          <div class="swiper" bind:this={swiperEl}>
            <div class="swiper-wrapper">
              {#each post.media as item (item.url)}
                <div class="swiper-slide">
                  {#if item.type === 'video'}
                    <div
                      class="video-wrapper"
                      style={item.width && item.height
                        ? `aspect-ratio: ${item.width} / ${item.height}`
                        : ''}
                    >
                      <video
                        src={item.url}
                        loop
                        bind:muted={audio.muted}
                        playsinline
                        autoplay
                        preload="metadata"
                        onloadedmetadata={revealFirstFrame}
                        onclick={togglePlayPause}
                      ></video>
                      <button
                        class="mute-btn"
                        onclick={toggleMute}
                        aria-label={audio.muted ? 'Unmute' : 'Mute'}
                      >
                        {@render muteIcon()}
                      </button>
                    </div>
                  {:else}
                    <div
                      class="media-placeholder"
                      style={item.width && item.height
                        ? `aspect-ratio: ${item.width} / ${item.height}`
                        : ''}
                    >
                      <img src={item.url} alt="" loading="lazy" />
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
            <div class="swiper-pagination"></div>
            <button class="nav-btn nav-prev" aria-label="Previous slide">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button class="nav-btn nav-next" aria-label="Next slide">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        {:else if post.media[0]?.type === 'video'}
          <div
            class="video-wrapper"
            style={post.media[0].width && post.media[0].height
              ? `aspect-ratio: ${post.media[0].width} / ${post.media[0].height}`
              : ''}
          >
            <video
              class="post-video"
              src={post.media[0].url}
              loop
              bind:muted={audio.muted}
              playsinline
              autoplay
              preload="metadata"
              onloadedmetadata={revealFirstFrame}
              onclick={togglePlayPause}
            ></video>
            <button
              class="mute-btn"
              onclick={toggleMute}
              aria-label={audio.muted ? 'Unmute' : 'Mute'}
            >
              {@render muteIcon()}
            </button>
          </div>
        {:else}
          <div
            class="media-placeholder"
            style={post.media[0]?.width && post.media[0]?.height
              ? `aspect-ratio: ${post.media[0].width} / ${post.media[0].height}`
              : ''}
          >
            <img class="post-image" src={post.media[0]?.url} alt="" />
          </div>
        {/if}
      {/key}
    </article>

    <div class="actions">
      <button
        class="btn-nav"
        disabled={!prevPost}
        onclick={() => prevPost && goto(`/accounts/${username}/${prevPost.shortcode}`)}
        aria-label="Previous post"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      {#if !offline.value}
        <button
          class="btn forget"
          class:active={rating === 'archive'}
          disabled={ratingLoading}
          onclick={() => rate('archive')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Forget
        </button>
        <button
          class="btn remember"
          class:active={rating === 'favorite'}
          disabled={ratingLoading}
          onclick={() => rate('favorite')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              fill={rating === 'favorite' ? 'currentColor' : 'none'}
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            />
          </svg>
          Remember
        </button>
      {/if}

      <button
        class="btn-nav"
        disabled={!nextPost}
        onclick={() => nextPost && goto(`/accounts/${username}/${nextPost.shortcode}`)}
        aria-label="Next post"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
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

  .back-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .back-btn svg {
    width: 14px;
    height: 14px;
  }

  @media (hover: hover) and (pointer: fine) {
    .back-btn:hover {
      color: var(--color-text);
      border-color: var(--color-text);
    }
  }

  .post-image {
    width: 100%;
    display: block;
  }

  .media-placeholder {
    width: 100%;
    background: var(--color-border-subtle);
    overflow: hidden;
  }

  .media-placeholder img {
    width: 100%;
    display: block;
  }

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

  .nav-prev {
    left: 8px;
  }

  .nav-next {
    right: 8px;
  }

  @media (hover: hover) and (pointer: fine) {
    .swiper:hover .nav-btn:not(.swiper-button-disabled) {
      display: flex;
    }
  }

  .actions {
    display: flex;
    gap: 10px;
    padding: 0 16px 16px;
    flex-shrink: 0;
  }

  .btn-nav {
    width: 52px;
    flex-shrink: 0;
    height: 56px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition:
      opacity 0.15s,
      transform 0.1s;
  }

  .btn-nav svg {
    width: 20px;
    height: 20px;
  }

  .btn-nav:active {
    transform: scale(0.96);
    opacity: 0.85;
  }

  .btn-nav:disabled {
    opacity: 0.25;
    cursor: default;
    transform: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .btn-nav:not(:disabled):hover {
      background: var(--color-border-subtle);
    }
  }

  .btn {
    flex: 1;
    height: 56px;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
    transition:
      opacity 0.15s,
      transform 0.1s;
  }

  .btn:active {
    transform: scale(0.96);
    opacity: 0.85;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: default;
    transform: none;
  }

  .btn svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .forget {
    border: 1.5px solid var(--color-action-forget);
    background: transparent;
    color: var(--color-action-forget);
  }

  .forget.active {
    background: var(--color-action-forget);
    color: #fff;
    border-color: transparent;
  }

  .remember {
    border: 1.5px solid var(--color-action-remember);
    background: transparent;
    color: var(--color-action-remember);
  }

  .remember.active {
    background: var(--color-action-remember);
    color: #fff;
    border-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .btn:not(:disabled):hover {
      opacity: 0.85;
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
    display: inline-block;
    text-decoration: none;
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
