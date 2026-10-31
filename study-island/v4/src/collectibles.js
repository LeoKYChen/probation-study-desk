// 每日採集點：海灘貝殼、樹林的木材／葉子／果實。採集狀態以「本機日期 + 採集點 ID」去重。
export const SPOTS = [
  { id: 'beach-shell-1', material: 'shell', x: 3, y: 13 },
  { id: 'beach-shell-2', material: 'shell', x: 9, y: 14 },
  { id: 'beach-shell-3', material: 'shell', x: 15, y: 13 },
  { id: 'forest-wood-1', material: 'wood', x: 12, y: 3 },
  { id: 'forest-wood-2', material: 'wood', x: 17, y: 4 },
  { id: 'forest-wood-3', material: 'wood', x: 15, y: 8 },
  { id: 'forest-leaf-1', material: 'leaf', x: 14, y: 5 },
  { id: 'forest-leaf-2', material: 'leaf', x: 16, y: 7 },
  { id: 'forest-leaf-3', material: 'leaf', x: 13, y: 4 },
  { id: 'forest-fruit-1', material: 'fruit', x: 16, y: 3 },
  { id: 'forest-fruit-2', material: 'fruit', x: 17, y: 6 }
];

export function spotById(id) {
  return SPOTS.find(s => s.id === id) || null;
}

export function spotAt(x, y) {
  return SPOTS.find(s => s.x === x && s.y === y) || null;
}

export function isCollected(save, spotId, date) {
  const list = save.collected && save.collected[date];
  return Array.isArray(list) && list.includes(spotId);
}

export function availableSpots(save, date) {
  return SPOTS.filter(s => !isCollected(save, s.id, date));
}

export function collectedCount(save, date, material) {
  const list = (save.collected && save.collected[date]) || [];
  return SPOTS.filter(s => s.material === material && list.includes(s.id)).length;
}

export function spotTotal(material) {
  return SPOTS.filter(s => s.material === material).length;
}

// 本機日期（YYYY-MM-DD），每日更新依此判斷。
export function localDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
