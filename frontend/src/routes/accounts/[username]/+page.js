export async function load({ fetch, params }) {
  const cacheKey = `cache_account_${params.username}_v1`;
  try {
    const [profileRes, postsRes] = await Promise.all([
      fetch(`/api/accounts/${params.username}`),
      fetch(`/api/accounts/${params.username}/posts`),
    ]);
    const profile = profileRes.ok ? await profileRes.json() : null;
    const postsData = postsRes.ok ? await postsRes.json() : { posts: [] };
    const result = {
      profile,
      posts: Array.isArray(postsData?.posts) ? postsData.posts : [],
    };
    if (typeof localStorage !== 'undefined' && profile) {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    }
    return result;
  } catch {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore malformed cache
        }
      }
    }
    return { profile: null, posts: [] };
  }
}
