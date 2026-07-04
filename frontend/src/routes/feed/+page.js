const CACHE_KEY = 'cache_feed_v1';
const SORT_KEY = 'feed_sort_v1';

export async function load({ fetch }) {
  const sort =
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem(SORT_KEY) ?? 'post_timestamp')
      : 'post_timestamp';
  try {
    const res = await fetch(`/api/feed?sort=${sort}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const posts = Array.isArray(data?.posts) ? data.posts : [];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(posts));
    }
    return { posts, sort };
  } catch {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          return { posts: JSON.parse(cached), sort };
        } catch {
          // ignore malformed cache
        }
      }
    }
    return { posts: [], sort };
  }
}
