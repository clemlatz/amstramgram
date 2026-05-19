<script>
  import { avatarColor, hideAvatarImage } from '$lib/media.js';
  let { account, active = true, size = 36 } = $props();
</script>

<div
  class="avatar-ring"
  class:inactive={!active}
  style="--size: {size}px; --font-size: {Math.round(size * 0.36)}px"
>
  <div class="avatar-inner" style="background: {avatarColor(account)}">
    <img
      class="avatar-img"
      src="/api/accounts/{account}/avatar"
      alt={account}
      onerror={hideAvatarImage}
    />
    {(account?.[0] ?? '').toUpperCase()}
  </div>
</div>

<style>
  .avatar-ring {
    width: var(--size, 36px);
    height: var(--size, 36px);
    border-radius: 50%;
    padding: 2px;
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
    flex-shrink: 0;
  }

  .avatar-ring.inactive {
    background: var(--color-border);
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
    font-size: var(--font-size, 13px);
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
</style>
