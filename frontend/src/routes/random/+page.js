export async function load({ fetch }) {
  const res = await fetch('/api/random');
  if (!res.ok) return { photo: null };
  return res.json();
}
