async function safeJson(res, fallback) {
  try { return await res.json(); } catch { return fallback; }
}

export async function load({ fetch }) {
  try {
    const [settingsRes, statsRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/stats'),
    ]);
    const settings = settingsRes.ok
      ? await safeJson(settingsRes, { username: null, session_id: null })
      : { username: null, session_id: null };
    const stats = statsRes.ok
      ? await safeJson(statsRes, { total: 0, diskBytes: 0 })
      : { total: 0, diskBytes: 0 };
    return { ...settings, total: stats.total ?? 0, diskBytes: stats.diskBytes ?? 0 };
  } catch {
    return { username: null, session_id: null, total: 0, diskBytes: 0 };
  }
}
