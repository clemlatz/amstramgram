<script>
  import { onMount } from 'svelte';
  import { page, navigating } from '$app/stores';
  import { audio } from '$lib/audio.svelte.js';
  import { offline, connection } from '$lib/offline.svelte.js';

  let { children } = $props();
  let checkTimer = null;

  const blocked = $derived(connection.state !== 'online');
  const needsAuth = $derived(connection.state === 'unauthenticated');
  // The VR viewer is a full-screen, chrome-free surface — no tab bar, no pills.
  const isVR = $derived($page.url.pathname === '/vr');

  async function checkServer() {
    try {
      const res = await fetch('/api/stats', { signal: AbortSignal.timeout(3000) });
      // The auth proxy now returns a clean same-origin 401 for expired sessions
      // instead of a cross-origin redirect — distinguishable from a real outage.
      if (res.status === 401 || res.status === 403) {
        connection.state = 'unauthenticated';
      } else {
        connection.state = res.ok ? 'online' : 'offline';
      }
    } catch {
      connection.state = 'offline';
    }

    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkServer, blocked ? 10_000 : 15_000);
  }

  function reLogin() {
    // Reload the current page as a top-level document navigation. Navigations
    // are NetworkFirst (SW) and the server is reachable, so the request hits the
    // auth proxy, which redirects HTML navigations through its login flow and
    // back to this exact URL — no need to hardcode the proxy's sign-in endpoint.
    window.location.reload();
  }

  function handleVisibilityChange() {
    if (document.hidden) audio.muted = true;
  }

  async function reloadApp() {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) await registration.update();
      }
    } catch {
      // ignore — reload regardless
    }
    window.location.reload();
  }

  onMount(() => {
    checkServer();
    window.addEventListener('online', checkServer);
    window.addEventListener('offline', checkServer);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('online', checkServer);
      window.removeEventListener('offline', checkServer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(checkTimer);
    };
  });
</script>

<svelte:head>
  <title>Amstramgram</title>
</svelte:head>

{#if $navigating}
  <div class="nav-progress" aria-hidden="true">
    <div class="nav-progress-bar"></div>
  </div>
{/if}

{#if isVR}
  <!-- VR viewer manages its own connection UI -->
{:else if needsAuth}
  <button class="offline-pill auth-pill" onclick={reLogin} aria-live="polite">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
    <span>Session expired — sign in</span>
  </button>
{:else if blocked}
  <div class="offline-pill" role="status" aria-live="polite">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
    <span>Offline</span>
  </div>
{/if}

<div class="content" class:vr={isVR}>
  {#if blocked && !isVR && $page.url.pathname !== '/' && $page.url.pathname !== '/feed' && !$page.params.shortcode}
    {#if needsAuth}
      <div class="offline-page">
        <svg
          class="offline-page-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p class="offline-page-title">Session expired</p>
        <p class="offline-page-sub">Sign in again to continue.</p>
        <button class="reload-btn" onclick={reLogin}>Sign in</button>
      </div>
    {:else}
      <div class="offline-page">
        <svg
          class="offline-page-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <p class="offline-page-title">Not available offline</p>
        <p class="offline-page-sub">This page requires a connection.</p>
        <button class="reload-btn" onclick={reloadApp}>Reload app</button>
      </div>
    {/if}
  {:else}
    {@render children()}
  {/if}
</div>

<nav class="tab-bar" aria-label="Main navigation" class:hidden={isVR}>
  <a href="/" class="tab" class:active={$page.url.pathname === '/'} aria-label="Pick">
    {#if $page.url.pathname === '/'}
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" />
        <circle cx="8.5" cy="8.5" r="1.5" style="fill: var(--color-bg)" />
        <circle cx="15.5" cy="8.5" r="1.5" style="fill: var(--color-bg)" />
        <circle cx="12" cy="12" r="1.5" style="fill: var(--color-bg)" />
        <circle cx="8.5" cy="15.5" r="1.5" style="fill: var(--color-bg)" />
        <circle cx="15.5" cy="15.5" r="1.5" style="fill: var(--color-bg)" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="2" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" />
        <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
      </svg>
    {/if}
  </a>

  <a href="/feed" class="tab" class:active={$page.url.pathname === '/feed'} aria-label="Feed">
    {#if $page.url.pathname === '/feed'}
      <!-- Grid feed filled -->
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
        <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" />
        <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" />
        <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" />
      </svg>
    {:else}
      <!-- Grid feed outline -->
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="2" />
        <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="2" />
      </svg>
    {/if}
  </a>

  <a
    href="/following"
    class="tab"
    class:active={$page.url.pathname === '/following' || $page.url.pathname.startsWith('/accounts')}
    aria-label="Following"
  >
    {#if $page.url.pathname === '/following'}
      <!-- User group filled (Heroicons solid user-group) -->
      <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z"
        />
      </svg>
    {:else}
      <!-- User group outline -->
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    {/if}
  </a>

  <a
    href="/settings"
    class="tab"
    class:active={$page.url.pathname === '/settings'}
    aria-label="Settings"
  >
    {#if $page.url.pathname === '/settings'}
      <!-- Gear filled (Heroicons solid cog-6-tooth) -->
      <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
        />
      </svg>
    {:else}
      <!-- Gear outline (Heroicons outline cog-6-tooth) -->
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    {/if}
  </a>
</nav>

<style>
  :global(:root) {
    --color-bg: #ffffff;
    --color-text: #262626;
    --color-text-muted: #767676;
    --color-border: #dbdbdb;
    --color-border-subtle: #efefef;
    --color-tab-bar: rgba(255, 255, 255, 0.92);
    --color-tab-border: rgba(0, 0, 0, 0.15);
    --color-tab-inactive: #767676;
    --color-tab-active: #262626;
    --color-nav-btn: rgba(255, 255, 255, 0.9);
    --color-nav-btn-text: #262626;
    --color-avatar-border: #ffffff;
    --color-empty-icon: #c7c7cc;
    --color-favorite: #ed4956;
    --color-action-forget: #8b2035;
    --color-action-remember: #2d6a4f;
    --color-error: #e03131;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --color-bg: #000000;
      --color-text: #f5f5f5;
      --color-text-muted: #a8a8a8;
      --color-border: #363636;
      --color-border-subtle: #1c1c1e;
      --color-tab-bar: rgba(0, 0, 0, 0.92);
      --color-tab-border: rgba(255, 255, 255, 0.15);
      --color-tab-inactive: #a8a8a8;
      --color-tab-active: #f5f5f5;
      --color-nav-btn: rgba(30, 30, 30, 0.9);
      --color-nav-btn-text: #f5f5f5;
      --color-avatar-border: #000000;
      --color-empty-icon: #4a4a4a;
    }
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :global(body) {
    background: var(--color-bg);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  :global(:focus-visible) {
    outline: 2px solid var(--color-text);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(*, *::before, *::after) {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  .content {
    padding-bottom: calc(49px + env(safe-area-inset-bottom, 0px));
  }

  .content.vr {
    padding: 0;
  }

  .tab-bar.hidden {
    display: none;
  }

  .tab-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    will-change: transform;
    height: calc(49px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--color-tab-bar);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 0.5px solid var(--color-tab-border);
    display: flex;
    align-items: center;
    justify-content: space-around;
    z-index: 100;
  }

  .tab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    color: var(--color-tab-inactive);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    transition:
      color 0.15s,
      transform 0.1s;
  }

  .tab.active {
    color: var(--color-tab-active);
  }

  .tab:active {
    transform: scale(0.88);
  }

  @media (min-width: 768px) {
    .content {
      padding-bottom: 0;
      padding-left: 64px;
    }

    .tab-bar {
      width: 64px;
      height: 100dvh;
      top: 0;
      bottom: auto;
      right: auto;
      flex-direction: column;
      justify-content: flex-start;
      gap: 4px;
      padding: 20px 0;
      border-top: none;
      border-right: 0.5px solid var(--color-tab-border);
    }

    .tab {
      width: 44px;
      height: 44px;
    }

    .tab svg {
      width: 22px;
      height: 22px;
    }

    .tab:hover {
      color: var(--color-tab-active);
      background: var(--color-border-subtle);
      border-radius: 8px;
    }
  }

  .tab svg {
    width: 26px;
    height: 26px;
  }

  .nav-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    z-index: 9998;
    background: var(--color-border-subtle);
    overflow: hidden;
  }

  .nav-progress-bar {
    height: 100%;
    background: var(--color-text);
    width: 40%;
    animation: nav-slide 1.2s ease-in-out infinite;
    transform-origin: left;
  }

  @keyframes nav-slide {
    0% {
      transform: translateX(-100%) scaleX(1);
    }
    50% {
      transform: translateX(150%) scaleX(1.5);
    }
    100% {
      transform: translateX(400%) scaleX(1);
    }
  }

  .offline-pill {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 8px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px 5px 9px;
    border-radius: 100px;
    background: var(--color-text-muted);
    color: var(--color-bg);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.01em;
    white-space: nowrap;
    pointer-events: none;
    animation: pill-in 0.2s ease-out;
  }

  .offline-pill svg {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }

  .auth-pill {
    border: none;
    font-family: inherit;
    cursor: pointer;
    pointer-events: auto;
    background: var(--color-text);
  }

  .auth-pill:active {
    opacity: 0.85;
  }

  .offline-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: calc(100dvh - 49px - env(safe-area-inset-bottom, 0px));
    padding: 32px;
    text-align: center;
  }

  @media (min-width: 768px) {
    .offline-page {
      min-height: 100dvh;
    }
  }

  .offline-page-icon {
    width: 48px;
    height: 48px;
    color: var(--color-empty-icon);
  }

  .offline-page-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text);
  }

  .offline-page-sub {
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .reload-btn {
    margin-top: 4px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    color: var(--color-bg);
    background: var(--color-text);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .reload-btn:active {
    opacity: 0.7;
  }

  @keyframes pill-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
