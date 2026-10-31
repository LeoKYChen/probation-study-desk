// 背包：材料 ID → 數量，家具 ID → 數量。
export const MATERIALS = [
  { id: 'shell', name: '貝殼', icon: '🐚', where: '海灘' },
  { id: 'wood', name: '木材', icon: '🪵', where: '樹林' },
  { id: 'leaf', name: '葉子', icon: '🍃', where: '樹林' },
  { id: 'fruit', name: '果實', icon: '🍎', where: '樹林' }
];

export const FURNITURE = [
  { id: 'starter-stool', name: '新手木凳', icon: '🪑', note: '新手禮物，到「建造」就能擺在島上。' },
  { id: 'wood-chair', name: '木椅', icon: '🪑', note: '工坊製作的木椅。' },
  { id: 'flowerbed', name: '花圃', icon: '🌷', note: '工坊製作的花圃。' },
  { id: 'lantern', name: '小燈籠', icon: '🏮', note: '工坊製作的小燈籠。' }
];

export const OPEN_MATERIALS = new Set(MATERIALS.map(m => m.id));

export function furnitureById(id) {
  return FURNITURE.find(f => f.id === id) || null;
}

export function emptyInventory() {
  return {
    materials: Object.fromEntries(MATERIALS.map(m => [m.id, 0])),
    furniture: { 'starter-stool': 1 },
    pills: {}
  };
}

export function count(inv, materialId) {
  const n = inv && inv.materials && inv.materials[materialId];
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function addMaterial(inv, materialId, n = 1) {
  if (!MATERIALS.some(m => m.id === materialId)) throw new Error('未知材料：' + materialId);
  inv.materials[materialId] = count(inv, materialId) + n;
  return inv.materials[materialId];
}

export function furnitureCount(inv, id) {
  const n = inv && inv.furniture && inv.furniture[id];
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function addFurniture(inv, id, n = 1) {
  if (!furnitureById(id)) throw new Error('未知家具：' + id);
  const next = furnitureCount(inv, id) + n;
  if (next > 0) inv.furniture[id] = next; else delete inv.furniture[id];
  return next;
}

export function furnitureList(inv) {
  return FURNITURE.map(f => ({ ...f, qty: furnitureCount(inv, f.id) })).filter(f => f.qty > 0);
}
