export async function load({ fetch }) {
  const res = await fetch('/api/accounts');
  const accounts = await res.json();
  return { accounts };
}
