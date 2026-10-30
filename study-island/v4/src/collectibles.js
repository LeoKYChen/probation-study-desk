// 每日採集點。Demo A 只開放海灘的 3 個貝殼；採集狀態以「本機日期 + 採集點 ID」去重。
export const SPOTS = [
  { id: 'beach-shell-1', material: 'shell', x: 3, y: 13 },
  { id: 'beach-shell-2', material: 'shell', x: 9, y: 14 },
  { id: 'beach-shell-3', material: 'shell', x: 15, y: 13 }
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

// 本機日期（YYYY-MM-DD），每日更新依此判斷。
export function localDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
