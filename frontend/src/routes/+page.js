export async function load({ fetch }) {
  try {
    const res = await fetch('/api/feed');
    if (!res.ok) return { photos: [] };
    const data = await res.json();
    return { photos: Array.isArray(data?.photos) ? data.photos : [] };
  } catch {
    return { photos: [] };
  }
}
