// 家具擺放規則：只能放在空的地面；不能放在小路／路口、採集點、居民家、玩家或居民身上，
// 也不能把任何原本走得到的地方封死。
import { MAP_W, MAP_H, isWalkable, tileAt, SPAWN } from './map.js';
import { SPOTS } from '../collectibles.js';
import { NPCS } from '../npc/dialogue.js';

const NO_BUILD = new Set(['path']);

export function furnitureAt(save, x, y) {
  return (save.placed || []).find(p => p.x === x && p.y === y) || null;
}

// 地形可走且沒有家具。
export function isOpen(save, x, y) {
  return isWalkable(x, y) && !furnitureAt(save, x, y);
}

function reachableCount(open, from) {
  if (!open(from.x, from.y)) return 0;
  const seen = new Set([from.y * MAP_W + from.x]), stack = [from];
  while (stack.length) {
    const c = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx, y = c.y + dy, k = y * MAP_W + x;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || seen.has(k) || !open(x, y)) continue;
      seen.add(k); stack.push({ x, y });
    }
  }
  return seen.size;
}

// actors：目前玩家與居民所在的格子（含正在走向的格子）。回傳 { ok, reason }。
export function canPlace(save, x, y, actors = []) {
  if (!isWalkable(x, y)) return { ok: false, reason: 'terrain' };
  if (NO_BUILD.has(tileAt(x, y).id)) return { ok: false, reason: 'path' };
  if (furnitureAt(save, x, y)) return { ok: false, reason: 'furniture' };
  if (SPOTS.some(s => s.x === x && s.y === y)) return { ok: false, reason: 'spot' };
  if (NPCS.some(n => n.home.x === x && n.home.y === y)) return { ok: false, reason: 'home' };
  if (actors.some(a => a.x === x && a.y === y)) return { ok: false, reason: 'actor' };
  const before = reachableCount((a, b) => isOpen(save, a, b), SPAWN);
  const after = reachableCount((a, b) => isOpen(save, a, b) && !(a === x && b === y), SPAWN);
  if (after < before - 1) return { ok: false, reason: 'blocks' };
  return { ok: true };
}

export const PLACE_REASONS = {
  terrain: '那裡不是可以擺東西的地面。',
  path: '小路要留給大家走，換個地方吧。',
  furniture: '那裡已經有家具了。',
  spot: '那裡是採集點，擺了就撿不到東西了。',
  home: '那是居民最喜歡站的地方，換個位置吧。',
  actor: '有人站在那裡。',
  blocks: '擺在這裡會把路堵住，換個地方吧。'
};
