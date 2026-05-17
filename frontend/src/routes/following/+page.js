export async function load({ fetch }) {
  try {
    const res = await fetch('/api/accounts');
    if (!res.ok) return { accounts: [] };
    const data = await res.json();
    return { accounts: Array.isArray(data) ? data : [] };
  } catch {
    return { accounts: [] };
  }
}
