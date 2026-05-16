<script>
  import 'swiper/css';
  import 'swiper/css/pagination';
  import { onMount } from 'svelte';

  let { post } = $props();

  const isCarousel = $derived(post.media.length > 1);

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

  const AVATAR_COLORS = ['#e91e63', '#9c27b0', '#2196f3', '#00bcd4', '#ff5722', '#ff9800'];

  function hideAvatarImage(e) {
    e.target.style.display = 'none';
  }

  function avatarColor(account) {
    let h = 0;
    for (const c of account) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function formatDate(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (mins < 60) return rtf.format(-mins, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    if (days < 7) return rtf.format(-days, 'day');
    return new Date(ts).toLocaleDateString('en', { day: 'numeric', month: 'short' });
  }

  function togglePlayPause(e) {
    const video = e.currentTarget;
    video.paused ? video.play() : video.pause();
  }

  function toggleMute(e) {
    e.stopPropagation();
    muted = !muted;
  }

  onMount(async () => {
    if (!isCarousel) return;
    const { default: Swiper } = await import('swiper');
    const { Pagination, Navigation } = await import('swiper/modules');
    const swiper = new Swiper(swiperEl, {
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
    return () => swiper.destroy();
  });
</script>

<article class="post">
  <header class="post-header">
    <div class="avatar-ring">
      <div class="avatar-inner" style="background: {avatarColor(post.account)}">
        <img
          class="avatar-img"
          src="/api/accounts/{post.account}/avatar"
          alt={post.account}
          onerror={hideAvatarImage}
        />
        {post.account[0].toUpperCase()}
      </div>
    </div>
    <div class="post-meta">
      <div class="post-account">
        <a href="https://instagram.com/{post.account}" target="_blank">
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

  {#if isCarousel}
    <div class="swiper" bind:this={swiperEl}>
      <div class="swiper-wrapper">
        {#each post.media as item}
          <div class="swiper-slide">
            {#if item.type === 'video'}
              <div class="video-wrapper">
                <video src={item.url} loop bind:muted={muted} playsinline onclick={togglePlayPause}></video>
                <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
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
  {:else if post.media[0].type === 'video'}
    <div class="video-wrapper">
      <video class="post-video" src={post.media[0].url} loop bind:muted={muted} playsinline onclick={togglePlayPause}></video>
      <button class="mute-btn" onclick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
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
      </button>
    </div>
  {:else}
    <img class="post-image" src={post.media[0].url} alt="" loading="lazy" />
  {/if}

  <p class="post-caption">{post.caption}</p>
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
  .avatar-ring {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    padding: 2px;
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
    flex-shrink: 0;
  }
  .avatar-inner {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid var(--color-avatar-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }
  .avatar-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
  }
  .post-meta {
    flex: 1;
  }
  .header-fav-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }
  .header-fav-btn svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: #8e8e8e;
    transition: fill 0.15s, stroke 0.15s;
  }
  .header-fav-btn.active svg {
    fill: #ed4956;
    stroke: #ed4956;
  }
  .post-account a {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.2;
    text-decoration: none;
  }
  .post-date {
    font-size: 12px;
    color: #8e8e8e;
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
    bottom: 10px;
    right: 10px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    -webkit-tap-highlight-color: transparent;
    z-index: 10;
  }
  .mute-btn svg {
    width: 16px;
    height: 16px;
    stroke: #fff;
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
    stroke: #8e8e8e;
    transition: fill 0.15s, stroke 0.15s;
  }
  .action-btn.active svg {
    fill: var(--color-text);
    stroke: var(--color-text);
  }
  .action-btn.favorite.active svg {
    fill: #ed4956;
    stroke: #ed4956;
  }
  .action-btn:disabled {
    cursor: default;
  }
  .action-btn:disabled svg {
    stroke: var(--color-border);
  }
</style>
