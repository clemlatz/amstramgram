const AVATAR_COLORS = ['#e91e63', '#9c27b0', '#2196f3', '#00bcd4', '#ff5722', '#ff9800'];

export function avatarColor(account) {
  let h = 0;
  for (const c of account) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function hideAvatarImage(e) {
  e.target.style.display = 'none';
}

export function formatDate(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const currentYear = new Date().getFullYear();

  if (mins < 60) return rtf.format(-mins, 'minute');
  if (hours < 24) return rtf.format(-hours, 'hour');
  if (days < 7) return rtf.format(-days, 'day');
  if (date.getFullYear() === currentYear) return date.toLocaleDateString('en', { day: 'numeric', month: 'long' });
  return date.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
}
