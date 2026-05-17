export async function load({ fetch }) {
  try {
    const res = await fetch('/api/random');
    if (!res.ok) return { photo: null, loadError: true };
    const data = await res.json();
    return { photo: data?.photo ?? null };
  } catch {
    return { photo: null, loadError: true };
  }
}
