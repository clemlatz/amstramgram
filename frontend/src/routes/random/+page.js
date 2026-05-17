const MODE_KEY = 'random-mode';

export async function load({ fetch }) {
  const mode = (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)) || 'all';
  const endpoint = mode === 'favorites' ? '/api/random/favorites' : '/api/random';

  try {
    const res = await fetch(endpoint);
    if (!res.ok) return { post: null, loadError: true };
    const { post } = await res.json();
    return { post: post ?? null };
  } catch {
    return { post: null, loadError: true };
  }
}
