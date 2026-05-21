const CACHE_KEY = 'cache_accounts_v1';

export async function load({ fetch }) {
  try {
    const res = await fetch('/api/accounts');
    if (!res.ok) throw new Error();
    const data = await res.json();
    const accounts = Array.isArray(data) ? data : [];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(accounts));
    }
    return { accounts };
  } catch {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          return { accounts: JSON.parse(cached) };
        } catch {
          // ignore malformed cache
        }
      }
    }
    return { accounts: [] };
  }
}
