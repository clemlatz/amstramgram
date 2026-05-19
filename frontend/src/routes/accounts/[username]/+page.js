export async function load({ fetch, params }) {
  try {
    const [profileRes, postsRes] = await Promise.all([
      fetch(`/api/accounts/${params.username}`),
      fetch(`/api/accounts/${params.username}/posts`),
    ]);
    const profile = profileRes.ok ? await profileRes.json() : null;
    const postsData = postsRes.ok ? await postsRes.json() : { posts: [] };
    return {
      profile,
      posts: Array.isArray(postsData?.posts) ? postsData.posts : [],
    };
  } catch {
    return { profile: null, posts: [] };
  }
}
