<script>
  import 'swiper/css';
  import 'swiper/css/pagination';
  import { onMount } from 'svelte';
  import Avatar from '$lib/Avatar.svelte';
  import { formatDate } from '$lib/media.js';

  let { post } = $props();

  const isCarousel = $derived((post.media?.length ?? 0) > 1);

  let archived = $state(!!post.archived_at);
  let favorited = $state(!!post.favorited_at);
  let muted = $state(true);

  async function rate(action) {
    if (!post.shortcode) return;

    const prevArchived = archived;
    const prevFavorited = favorited;

    const effectiveAction =
      (action === 'archive' && archived) || (action === 'favorite' && favorited)
        ? 'clear'
        : action;

    if (effectiveAction === 'archive') {
      archived = true;
      favorited = false;
    } else if (effectiveAction === 'favorite') {
      favorited = true;
      archived = false;
    } else {
      archived = false;
      favorited = false;
    }

    try {
      const res = await fetch('/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcode: post.shortcode, action: effectiveAction }),
      });
      if (!res.ok) throw new Error('rate failed');
    } catch {
      archived = prevArchived;
      favorited = prevFavorited;
    }
  }

  let swiperEl = $state(null);

  function togglePlayPause(e) {
    const video = e.currentTarget;
    video.paused ? video.play().catch(() => {}) : video.pause();
  }

  function toggleMute(e) {
    e.stopPropagation();
    muted = !muted;
  }

  onMount(() => {
    if (!isCarousel) return;
    let swiper = null;
    let cancelled = false;

    (async () => {
      try {
        const { default: Swiper } = await import('swiper');
        const { Pagination, Navigation } = await import('swiper/modules');
        if (cancelled || !swiperEl) return;
        swiper = new Swiper(swiperEl, {
          modules: [Pagination, Navigation],
          pagination: {
            el: swiperEl.querySelector('.swiper-pagination'),
            clickable: false,
          },
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
      cancelled = true;
      swiper?.destroy();
    };
  });
</script>

<article class="post">
  <header class="post-header">
    <Avatar account={post.account} active={post.account_active ?? true} />
    <div class="post-meta">
      <div class="post-account">
        <a href="https://instagram.com/{post.account}" target="_blank" rel="noopener noreferrer">
          {post.account}
        </a>
      </div>
      <div class="post-date">{formatDate(post.post_timestamp)}</div>
    </div>
    <button
      class="header-fav-btn"
      class:active={favorited}
      aria-label={favorited ? 'Forget' : 'Remember'}
      aria-pressed={favorited}
      onclick={() => rate('favorite')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  </header>

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

  {#if isCarousel}
    <div class="swiper" bind:this={swiperEl}>
      <div class="swiper-wrapper">
        {#each post.media as item}
          <div class="swiper-slide">
            {#if item.type === 'video'}
              <div class="video-wrapper">
                <video src={item.url} loop bind:muted={muted} playsinline autoplay={false} onclick={togglePlayPause}></video>
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
      <video class="post-video" src={post.media[0].url} loop bind:muted={muted} playsinline autoplay={false} onclick={togglePlayPause}></video>
      <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
        {@render muteIcon()}
      </button>
    </div>
  {:else}
    <img class="post-image" src={post.media[0]?.url} alt="" loading="lazy" />
  {/if}

  {#if post.caption}
    <p class="post-caption">{post.caption}</p>
  {/if}
</article>

<style>
  .post {
    margin-bottom: 40px;
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
  .header-fav-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 12px;
    border-radius: 50%;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }
  .header-fav-btn svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: var(--color-text-muted);
    transition: fill 0.15s, stroke 0.15s;
  }
  .header-fav-btn.active svg {
    fill: var(--color-favorite);
    stroke: var(--color-favorite);
  }
  @media (hover: hover) and (pointer: fine) {
    .header-fav-btn:not(.active):hover svg {
      stroke: var(--color-text);
    }
    .header-fav-btn.active:hover svg {
      opacity: 0.75;
    }
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
  .post-caption {
    padding: 10px 14px 0;
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.5;
    overflow-wrap: break-word;
    word-break: break-word;
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
    background: rgba(0, 0, 0, 0.5);
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
  .action-bar {
    display: flex;
    border-top: 1px solid var(--color-border);
  }
  .action-btn {
    flex: 1;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg);
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .action-btn:first-child {
    border-right: 1px solid var(--color-border);
  }
  .action-btn svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: var(--color-text-muted);
    transition: fill 0.15s, stroke 0.15s;
  }
  .action-btn.active svg {
    fill: var(--color-text);
    stroke: var(--color-text);
  }
  .action-btn.favorite.active svg {
    fill: var(--color-favorite);
    stroke: var(--color-favorite);
  }
  .action-btn:disabled {
    cursor: default;
  }
  .action-btn:disabled svg {
    stroke: var(--color-border);
  }
</style>
