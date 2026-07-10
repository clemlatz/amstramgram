<script>
  import { onMount } from 'svelte';
  import { createStereoRenderer } from '$lib/stereoRenderer.js';
  import { PAD, createGamepadWatcher } from '$lib/gamepad.js';

  const CAL_KEY = 'vrbench';

  let canvasEl = $state(null);
  let videoEl = $state(null);

  let post = $state(null);
  let slide = $state(0); // active media index within the current post (carousels)
  let status = $state('loading'); // loading | ready | empty | error
  let toast = $state('');
  let muted = $state(true);
  let hudOff = $state(false);
  let showCal = $state(false);
  let gamepadOn = $state(false);
  let cal = $state({ sep: 0, zoom: 1, k1: 0.15, k2: 0 });

  let renderer = null;
  let busy = false;
  let toastTimer = null;

  // ── data ──
  async function fetchRandom() {
    const res = await fetch('/api/random');
    if (!res.ok) throw new Error('bad status');
    const { post: next } = await res.json();
    return next ?? null;
  }

  async function loadFirst() {
    try {
      post = await fetchRandom();
      slide = 0;
      status = post ? 'ready' : 'empty';
    } catch {
      status = 'error';
    }
  }

  async function loadNext() {
    if (busy) return;
    busy = true;
    try {
      const next = await fetchRandom();
      post = next;
      slide = 0;
      status = next ? 'ready' : 'empty';
    } catch {
      status = 'error';
    }
    busy = false;
  }

  async function rate(action) {
    if (busy || !post || status !== 'ready') return;
    const shortcode = post.shortcode;
    flash(action === 'favorite' ? '★ Favorite' : '✕ Archive');
    fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcode, action })
    }).catch(() => {});
    await loadNext();
  }

  // Advance within a carousel, wrapping back to the first slide at the end.
  function nextSlide() {
    if (busy || status !== 'ready' || !post) return;
    const n = post.media?.length ?? 0;
    if (n < 2) return;
    slide = (slide + 1) % n;
    flash(`${slide + 1}/${n}`);
  }

  // Step back within a carousel, stopping at the first slide.
  function prevSlide() {
    if (busy || status !== 'ready' || !post) return;
    const n = post.media?.length ?? 0;
    if (n < 2 || slide === 0) return;
    slide -= 1;
    flash(`${slide + 1}/${n}`);
  }

  function togglePlay() {
    if (!videoEl) return;
    if (videoEl.paused) videoEl.play().catch(() => {});
    else videoEl.pause();
    flash(videoEl.paused ? '❚❚' : '▶');
  }

  // Nudge the eye separation (D-pad), clamped to the slider's range.
  function adjustSep(delta) {
    cal.sep = Math.max(-0.3, Math.min(0.3, +(cal.sep + delta).toFixed(3)));
    applyCal();
    flash(`sep ${cal.sep.toFixed(3)}`);
  }

  function flash(text) {
    toast = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 900);
  }

  function retry() {
    status = 'loading';
    loadFirst();
  }

  // ── calibration (shared with the standalone /vr.html bench) ──
  function loadCal() {
    try {
      const stored = JSON.parse(localStorage.getItem(CAL_KEY) || 'null');
      if (stored) cal = { ...cal, ...stored };
    } catch {
      // keep defaults
    }
  }

  function applyCal() {
    renderer?.setParams(cal);
    try {
      localStorage.setItem(CAL_KEY, JSON.stringify(cal));
    } catch {
      // storage unavailable — tuning just won't persist
    }
  }

  function resetCal() {
    cal = { sep: 0, zoom: 1, k1: 0.15, k2: 0 };
    applyCal();
  }

  function toggleMute() {
    muted = !muted;
  }

  // ── swap the source whenever the post changes ──
  $effect(() => {
    const p = post;
    const idx = slide;
    if (!renderer || !videoEl) return;
    const media = p?.media?.[idx];
    if (!media) {
      renderer.clearMedia();
      videoEl.pause();
      videoEl.removeAttribute('src');
      return;
    }
    if (media.type === 'video') {
      videoEl.src = media.url;
      videoEl.play().catch(() => {});
      renderer.setVideo(videoEl);
    } else {
      videoEl.pause();
      videoEl.removeAttribute('src');
      const img = new Image();
      img.onload = () => renderer.setImage(img);
      img.src = media.url;
    }
  });

  // ── gamepad input ──
  function onPress(i) {
    if (i === PAD.FAVORITE) rate('favorite');
    else if (i === PAD.ARCHIVE) rate('archive');
    else if (i === PAD.ZR) post?.media?.[slide]?.type === 'video' ? togglePlay() : nextSlide();
    else if (i === PAD.R) prevSlide();
    else if (i === PAD.DLEFT) adjustSep(-0.01);
    else if (i === PAD.DRIGHT) adjustSep(0.01);
    if (i === PAD.MUTE) toggleMute();
  }

  function onResize() {
    renderer?.resize();
  }

  onMount(() => {
    loadCal();
    try {
      renderer = createStereoRenderer(canvasEl);
    } catch {
      status = 'error';
      return;
    }
    renderer.setParams(cal);
    renderer.resize();
    renderer.start();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

    const watcher = createGamepadWatcher({
      onPress,
      onConnection: (c) => (gamepadOn = c)
    });
    watcher.start();
    loadFirst();

    return () => {
      window.removeEventListener('resize', onResize);
      watcher.stop();
      clearTimeout(toastTimer);
      renderer?.destroy();
    };
  });
</script>

<svelte:head>
  <title>VR · Amstramgram</title>
</svelte:head>

{#snippet eye()}
  <div class="eye">
    {#if status === 'loading'}
      <p class="msg">Loading…</p>
    {:else if status === 'empty'}
      <p class="msg">All caught up</p>
    {:else if status === 'error'}
      <p class="msg">Connection error</p>
    {/if}
    {#if toast}
      <div class="toast">{toast}</div>
    {/if}
    {#if status === 'ready' && post}
      <div class="acct">
        {post.account}{#if post.media?.length > 1}&nbsp;·&nbsp;{slide + 1}/{post.media.length}{/if}
      </div>
    {/if}
  </div>
{/snippet}

<div class="vr" class:hud-off={hudOff}>
  <canvas class="gl" bind:this={canvasEl}></canvas>
  <!-- hidden decode surface for video frames -->
  <video class="src-video" bind:this={videoEl} playsinline loop muted={muted} preload="auto"></video>

  <!-- per-eye overlay: both halves show the same centred content -->
  <div class="stereo">
    {@render eye()}
    {@render eye()}
  </div>

  <!-- flat setup chrome (phone in hand, before the headset goes on) -->
  <div class="chrome">
    <a class="pill" href="/" aria-label="Exit VR">✕</a>
    <div class="hint">
      {#if gamepadOn}
        A favorite · B archive · X mute · ZR play/next · R prev · ←→ separation
      {:else}
        Connect a controller · tap to hide this UI
      {/if}
    </div>
    <button class="pill" onclick={() => (showCal = !showCal)} aria-label="Calibrate">⚙</button>
  </div>

  <!-- tap layer toggles the setup chrome -->
  <button class="tap" aria-label="Toggle UI" onclick={() => (hudOff = !hudOff)}></button>

  {#if status === 'error'}
    <button class="retry" onclick={retry}>Try again</button>
  {/if}

  {#if showCal}
    <section class="cal" aria-label="Calibration">
      <div class="cal-row">
        <label for="c-sep">Separation</label>
        <input id="c-sep" type="range" min="-0.30" max="0.30" step="0.005" bind:value={cal.sep} oninput={applyCal} />
        <output>{cal.sep.toFixed(3)}</output>
      </div>
      <div class="cal-row">
        <label for="c-zoom">Zoom</label>
        <input id="c-zoom" type="range" min="0.50" max="2.50" step="0.01" bind:value={cal.zoom} oninput={applyCal} />
        <output>{cal.zoom.toFixed(2)}×</output>
      </div>
      <div class="cal-row">
        <label for="c-k1">Barrel k1</label>
        <input id="c-k1" type="range" min="-0.50" max="0.50" step="0.005" bind:value={cal.k1} oninput={applyCal} />
        <output>{cal.k1.toFixed(3)}</output>
      </div>
      <div class="cal-row">
        <label for="c-k2">Barrel k2</label>
        <input id="c-k2" type="range" min="-0.40" max="0.40" step="0.005" bind:value={cal.k2} oninput={applyCal} />
        <output>{cal.k2.toFixed(3)}</output>
      </div>
      <div class="cal-actions">
        <button onclick={resetCal}>Reset</button>
        <button class="done" onclick={() => (showCal = false)}>Done</button>
      </div>
    </section>
  {/if}

  <div class="orient">
    <strong>Rotate to landscape</strong>
    <p>Turn the phone sideways before sliding it into the headset.</p>
    <a class="orient-exit" href="/">Exit VR</a>
  </div>
</div>

<style>
  .vr {
    position: fixed;
    inset: 0;
    background: #000;
    overflow: hidden;
    touch-action: none;
    --accent: #35e0c4;
    --edge: #1e2a2f;
    --panel: #0f1518;
    --dim: #7c8b91;
    --font-mono: ui-monospace, 'SF Mono', Menlo, monospace;
  }

  .gl {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .src-video {
    position: absolute;
    width: 2px;
    height: 2px;
    opacity: 0;
    pointer-events: none;
    left: -10px;
    top: -10px;
  }

  /* Per-eye overlay — two halves, content centred in each so both eyes read it */
  .stereo {
    position: absolute;
    inset: 0;
    display: flex;
    pointer-events: none;
    z-index: 2;
  }
  .eye {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .msg {
    color: #f5f5f5;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .toast {
    position: absolute;
    top: 12%;
    padding: 8px 18px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    color: var(--accent);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.03em;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: pop 0.18s ease-out;
  }
  .acct {
    position: absolute;
    bottom: 8%;
    color: rgba(245, 245, 245, 0.5);
    font-size: 12px;
    letter-spacing: 0.04em;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.96);
    }
  }

  /* Flat setup chrome */
  .chrome {
    position: absolute;
    top: max(10px, env(safe-area-inset-top));
    left: 0;
    right: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 max(12px, env(safe-area-inset-left)) 0 max(12px, env(safe-area-inset-right));
    transition: opacity 0.2s;
  }
  .hint {
    flex: 1;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--dim);
  }
  .pill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--panel) 82%, transparent);
    border: 1px solid var(--edge);
    color: #cdd8dc;
    font-size: 16px;
    text-decoration: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .tap {
    position: absolute;
    inset: 0;
    z-index: 3;
    background: transparent;
    border: none;
    padding: 0;
    cursor: default;
    -webkit-tap-highlight-color: transparent;
  }

  .hud-off .chrome {
    opacity: 0;
    pointer-events: none;
  }

  .retry {
    position: absolute;
    left: 50%;
    bottom: 14%;
    transform: translateX(-50%);
    z-index: 5;
    padding: 10px 22px;
    border-radius: 10px;
    border: 1px solid var(--edge);
    background: var(--panel);
    color: #cdd8dc;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Calibration overlay (flat — you take the headset off to tune) */
  .cal {
    position: absolute;
    left: 50%;
    bottom: max(16px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 6;
    width: min(520px, calc(100% - 24px));
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    border: 1px solid var(--edge);
    border-radius: 16px;
    padding: 14px 16px;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cal-row {
    display: grid;
    grid-template-columns: 84px 1fr 56px;
    align-items: center;
    gap: 10px;
  }
  .cal-row label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--dim);
  }
  .cal-row output {
    font-family: var(--font-mono);
    font-size: 12px;
    text-align: right;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
  .cal-row input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 24px;
    background: transparent;
  }
  .cal-row input[type='range']::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 3px;
    background: var(--edge);
  }
  .cal-row input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    margin-top: -7.5px;
    border-radius: 50%;
    background: #cdd8dc;
    border: 3px solid var(--accent);
  }
  .cal-row input[type='range']::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #cdd8dc;
    border: 3px solid var(--accent);
  }
  .cal-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--edge);
  }
  .cal-actions button {
    flex: 1;
    padding: 9px;
    border-radius: 10px;
    border: 1px solid var(--edge);
    background: transparent;
    color: var(--dim);
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .cal-actions .done {
    color: #04110e;
    background: var(--accent);
    border-color: var(--accent);
  }

  .orient {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
    padding: 32px;
    background: #06090b;
  }
  .orient strong {
    color: #f5f5f5;
    font-size: 18px;
  }
  .orient p {
    color: var(--dim);
    font-size: 14px;
    max-width: 30ch;
    line-height: 1.5;
  }
  .orient-exit {
    margin-top: 8px;
    padding: 10px 20px;
    border-radius: 999px;
    border: 1px solid var(--edge);
    background: var(--panel);
    color: #cdd8dc;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }
  @media (orientation: portrait) {
    .orient {
      display: flex;
    }
  }
</style>
