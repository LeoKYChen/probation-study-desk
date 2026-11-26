// 小樹灣 20×16 世界：地表、障礙物與碰撞。純資料與純函式，可在 Node 測試。
export const MAP_W = 20;
export const MAP_H = 16;

// ~ 海  s 沙灘  g 草地  f 樹林地面  p 小路  z 廣場  F 花（可走）
// H 小屋  T 樹  R 岩石  B 木桶  M 信箱  L 路燈  S 告示牌  C 南瓜田（不可走）
const ROWS = [
  '~~~~~~~~~~~~~~~~~~~~',
  '~~ggggggggggTgTTT~~~',
  '~ggggHHHgggggfTfTT~~',
  '~CFggHHHBgggfffTff~~',
  '~CggggpMgggTffTfff~~',
  '~ggFgppppppfffffTf~~',
  '~ggggpzzzzpffTffff~~',
  '~ggggpzzzzpfffTfff~~',
  '~gRgSpzzzzpgffffTf~~',
  '~ggggppppppgggfffg~~',
  '~sgggLpLggggggggggs~',
  '~ssgggpggFgggggggss~',
  '~sssggpgggggggggsss~',
  '~~ssssssssssssssss~~',
  '~~~sssssssssssss~~~~',
  '~~~~~~~~~~~~~~~~~~~~'
];

export const TERRAIN = {
  '~': { id: 'water', walkable: false, label: '海' },
  s: { id: 'sand', walkable: true, label: '沙灘' },
  g: { id: 'grass', walkable: true, label: '草地' },
  f: { id: 'forest', walkable: true, label: '樹林' },
  p: { id: 'path', walkable: true, label: '小路' },
  z: { id: 'plaza', walkable: true, label: '廣場' },
  F: { id: 'flower', walkable: true, label: '花叢' },
  H: { id: 'house', walkable: false, label: '小屋' },
  T: { id: 'tree', walkable: false, label: '樹' },
  R: { id: 'rock', walkable: false, label: '岩石' },
  B: { id: 'barrel', walkable: false, label: '木桶' },
  M: { id: 'mailbox', walkable: false, label: '信箱' },
  L: { id: 'lamp', walkable: false, label: '路燈' },
  S: { id: 'sign', walkable: false, label: '告示牌' },
  C: { id: 'crops', walkable: false, label: '南瓜田' }
};

export const HOUSE = { x: 5, y: 2, w: 3, h: 2, door: { x: 6, y: 4 } };
export const SPAWN = { x: 8, y: 10 };

export function tileAt(x, y) {
  if (!inBounds(x, y)) return TERRAIN['~'];
  return TERRAIN[ROWS[y][x]];
}

export function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

export function isWalkable(x, y) {
  return inBounds(x, y) && tileAt(x, y).walkable;
}

export function rows() {
  return ROWS.slice();
}

// 地圖上所有 type 為 id 的格子。
export function tilesOf(id) {
  const out = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) if (tileAt(x, y).id === id) out.push({ x, y });
  }
  return out;
}

// 由格子座標產生固定雜湊，用於裝飾的位置（每次載入外觀相同）。
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
