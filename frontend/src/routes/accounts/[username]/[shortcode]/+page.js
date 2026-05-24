export async function load({ params, fetch }) {
  const { username, shortcode } = params;
  const cacheKey = `cache_account_${username}_v1`;

  let posts = [];

  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (Array.isArray(data?.posts)) posts = data.posts;
      } catch {}
    }
  }

  if (posts.length === 0) {
    try {
      const res = await fetch(`/api/accounts/${username}/posts`);
      if (res.ok) {
        const data = await res.json();
        posts = Array.isArray(data?.posts) ? data.posts : [];
      }
    } catch {}
  }

  const post = posts.find((p) => p.shortcode === shortcode) ?? null;
  const notFound = posts.length > 0 && post === null;

  return { post, posts, notFound };
}
