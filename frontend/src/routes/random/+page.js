const MODE_KEY = 'random-mode';

export async function load({ fetch }) {
  const mode = (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)) || 'all';
  const endpoint = mode === 'favorites' ? '/api/random/favorites' : '/api/random';
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

  try {
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
