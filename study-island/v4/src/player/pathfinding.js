// 4 方向 A*：小地圖（20×16）每次點擊重新計算即可。
export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};

export function dirBetween(a, b) {
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) && dx) return dx > 0 ? 'right' : 'left';
  if (dy) return dy > 0 ? 'down' : 'up';
  return null;
}

// 回傳不含起點、含終點的格子陣列；無法到達回傳 null；起點即終點回傳 []。
export function findPath(start, goal, canWalk, w, h) {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!canWalk(goal.x, goal.y)) return null;
  const key = (x, y) => y * w + x;
  const open = [{ x: start.x, y: start.y, g: 0, f: 0 }];
  const came = new Map();
  const best = new Map([[key(start.x, start.y), 0]]);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [];
      let k = key(cur.x, cur.y);
      while (k !== key(start.x, start.y)) {
        path.push({ x: k % w, y: Math.floor(k / w) });
        k = came.get(k);
      }
      return path.reverse();
    }
    if (cur.g > best.get(key(cur.x, cur.y))) continue;
    for (const { dx, dy } of Object.values(DIRS)) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !canWalk(nx, ny)) continue;
      const g = cur.g + 1, nk = key(nx, ny);
      if (best.has(nk) && best.get(nk) <= g) continue;
      best.set(nk, g);
      came.set(nk, key(cur.x, cur.y));
      open.push({ x: nx, y: ny, g, f: g + Math.abs(goal.x - nx) + Math.abs(goal.y - ny) });
    }
  }
  return null;
}

// 走到目標「旁邊」：用於居民或障礙物前方。回傳最短的那條路徑與站位，找不到為 null。
export function pathToNeighbor(start, target, canWalk, w, h) {
  let best = null;
  for (const { dx, dy } of Object.values(DIRS)) {
    const t = { x: target.x + dx, y: target.y + dy };
    const p = findPath(start, t, canWalk, w, h);
    if (p && (!best || p.length < best.path.length)) best = { path: p, stand: t };
  }
  return best;
}
