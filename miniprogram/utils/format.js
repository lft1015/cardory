const RARITY_NAMES = { N: '普通', R: '稀有', SR: '超稀有', SSR: '最高稀有' };

const RARITY_ORDER = ['N', 'R', 'SR', 'SSR'];

const STATUS_LABELS = {
  DRAFT: '草稿',
  CHECKING: '检测中',
  PENDING_CONFIRMATION: '待确认',
  PUBLISHABLE: '可发布',
  PUBLISHED: '已上架',
  OFFLINE: '已下架',
  FORCE_REMOVED: '已移除'
};

const STATUS_COLORS = {
  DRAFT: '#7d9a83',
  CHECKING: '#5b8cc9',
  PENDING_CONFIRMATION: '#8b5cb8',
  PUBLISHABLE: '#6a9b5b',
  PUBLISHED: '#52c41a',
  OFFLINE: '#7d9a83',
  FORCE_REMOVED: '#ff4d4f'
};

function rarityName(rarity) {
  return RARITY_NAMES[rarity] || rarity;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function statusColor(status) {
  return STATUS_COLORS[status] || '#7d9a83';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sortCardsByRarity(cards) {
  return cards.slice().sort((a, b) => {
    const idxA = RARITY_ORDER.indexOf(a.rarity);
    const idxB = RARITY_ORDER.indexOf(b.rarity);
    if (idxA !== idxB) return idxB - idxA;
    return (a.name || '').localeCompare(b.name || '');
  });
}

module.exports = { rarityName, statusLabel, statusColor, formatDate, sortCardsByRarity };