const MODE_KEY = 'random-mode';

async function pickDownloadedPost() {
  const stored =
    typeof localStorage !== 'undefined' ? localStorage.getItem('offline-favorites-posts') : null;
  if (!stored) return null;
  let posts;
  try {
    posts = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!posts.length) return null;
  let available = posts;
  if ('caches' in window) {
    const cache = await caches.open('media-cache');
    const keys = await cache.keys();
    const downloadedPaths = new Set(keys.map((r) => new URL(r.url).pathname));
    available = posts.filter((p) => p.media.every((m) => downloadedPaths.has(m.url)));
  }
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export async function load({ fetch }) {
  const mode = (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)) || 'all';
  const storageKey = `random_post_${mode}`;

  if (typeof sessionStorage !== 'undefined') {
    const cached = sessionStorage.getItem(storageKey);
    if (cached) {
      try {
        return { post: JSON.parse(cached) };
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }
  }

  if (mode === 'downloaded') {
    try {
      const post = await pickDownloadedPost();
      if (post && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(storageKey, JSON.stringify(post));
      }
      return { post: post ?? null };
    } catch {
      return { post: null, loadError: true };
    }
  }

  try {
    const endpoint = mode === 'favorites' ? '/api/random/favorites' : '/api/random';
    const res = await fetch(endpoint);
    if (!res.ok) return { post: null, loadError: true };
    const { post } = await res.json();
    if (post && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(storageKey, JSON.stringify(post));
    }
    return { post: post ?? null };
  } catch {
    return { post: null, loadError: true };
  }
}
