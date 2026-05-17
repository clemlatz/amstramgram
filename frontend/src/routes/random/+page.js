const STORAGE_KEY = 'random_current_post';

export async function load({ fetch }) {
  if (typeof sessionStorage !== 'undefined') {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        return { post: JSON.parse(cached) };
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  try {
    const res = await fetch("/api/random");
    if (!res.ok) return { post: null, loadError: true };
    const data = await res.json();
    const post = data?.post ?? null;
    if (post && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(post));
    }
    return { post };
  } catch {
    return { post: null, loadError: true };
  }
}
