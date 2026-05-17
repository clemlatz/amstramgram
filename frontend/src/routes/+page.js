export async function load({ fetch }) {
  try {
    const res = await fetch("/api/feed");
    if (!res.ok) return { posts: [] };
    const data = await res.json();
    return { posts: Array.isArray(data?.posts) ? data.posts : [] };
  } catch {
    return { posts: [] };
  }
}
