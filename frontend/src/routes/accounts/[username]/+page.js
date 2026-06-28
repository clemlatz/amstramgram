export async function load({ fetch, params }) {
  const cacheKey = `cache_account_${params.username}_v1`;
  try {
    const profileRes = await fetch(`/api/accounts/${params.username}`);
    const profile = profileRes.ok ? await profileRes.json() : null;

    let posts = [];
    try {
      const postsRes = await fetch(`/api/accounts/${params.username}/posts`);
      const postsData = postsRes.ok ? await postsRes.json() : { posts: [] };
      posts = Array.isArray(postsData?.posts) ? postsData.posts : [];
    } catch {
      // posts failing shouldn't prevent showing the profile
    }

    const result = { profile, posts };
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
