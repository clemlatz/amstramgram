async function safeJson(res, fallback) {
  try {
    return await res.json();
  } catch {
    return fallback;
  }
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
      ? await safeJson(statsRes, { total: 0, images: 0, videos: 0, unrated: 0, favorites: 0, diskBytes: 0 })
      : { total: 0, images: 0, videos: 0, unrated: 0, favorites: 0, diskBytes: 0 };
    return {
      ...settings,
      total: stats.total ?? 0,
      images: stats.images ?? 0,
      videos: stats.videos ?? 0,
      unrated: stats.unrated ?? 0,
      favorites: stats.favorites ?? 0,
      diskBytes: stats.diskBytes ?? 0,
    };
  } catch {
    return {
      username: null,
      session_id: null,
      total: 0,
      images: 0,
      videos: 0,
      unrated: 0,
      favorites: 0,
      diskBytes: 0,
    };
  }
}
