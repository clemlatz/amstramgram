export async function load({ fetch }) {
  try {
    const res = await fetch("/api/random");
    if (!res.ok) return { post: null, loadError: true };
    const data = await res.json();
    return { post: data?.post ?? null };
  } catch {
    return { post: null, loadError: true };
  }
}
