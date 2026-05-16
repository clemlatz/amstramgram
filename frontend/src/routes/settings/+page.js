export async function load({ fetch }) {
  const [settingsRes, statsRes] = await Promise.all([
    fetch('/api/settings'),
    fetch('/api/stats'),
  ]);
  const settings = settingsRes.ok ? await settingsRes.json() : { username: null, session_id: null };
  const stats = statsRes.ok ? await statsRes.json() : { total: 0, diskBytes: 0 };
  return { ...settings, total: stats.total, diskBytes: stats.diskBytes };
}
