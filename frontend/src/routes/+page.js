export async function load({ fetch }) {
  const res = await fetch('/api/feed');
  if (!res.ok) return { photos: [] };
  return res.json();
}
