const CACHE_KEY = 'cache_feed_v1';

export async function load({ fetch }) {
  try {
    const res = await fetch('/api/feed');
    if (!res.ok) throw new Error();
    const data = await res.json();
    const posts = Array.isArray(data?.posts) ? data.posts : [];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(posts));
    }
    return { posts };
  } catch {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          return { posts: JSON.parse(cached) };
        } catch {
          // ignore malformed cache
        }
      }
    }
    return { posts: [] };
  }
}
