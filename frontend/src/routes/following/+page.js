export async function load({ fetch }) {
  const res = await fetch('/api/accounts');
  if (!res.ok) return { accounts: [] };
  const accounts = await res.json();
  return { accounts };
}
