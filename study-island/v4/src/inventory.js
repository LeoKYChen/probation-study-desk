// 背包：材料 ID → 數量，家具 ID → 數量。
export const MATERIALS = [
  { id: 'shell', name: '貝殼', icon: '🐚', where: '海灘' },
  { id: 'wood', name: '木材', icon: '🪵', where: '樹林' },
  { id: 'leaf', name: '葉子', icon: '🍃', where: '樹林' },
  { id: 'fruit', name: '果實', icon: '🍎', where: '樹林' }
];

export const FURNITURE = [
  { id: 'starter-stool', name: '新手木凳', icon: '🪑', note: '新手禮物，建造功能開放後可以擺在島上。' }
];

// 下一階段才開放的採集材料（Demo A 只有海灘貝殼）。
export const OPEN_MATERIALS = new Set(['shell']);

export function emptyInventory() {
  return {
    materials: Object.fromEntries(MATERIALS.map(m => [m.id, 0])),
    furniture: { 'starter-stool': 1 }
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

export function furnitureList(inv) {
  return FURNITURE.map(f => ({ ...f, qty: (inv.furniture && inv.furniture[f.id]) || 0 })).filter(f => f.qty > 0);
}
