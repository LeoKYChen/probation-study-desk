// 觀護學習島 v4 Demo A：地圖、尋路、採集去重、存檔正規化（純 Node，不需瀏覽器）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_W, MAP_H, rows, isWalkable, tileAt, SPAWN, HOUSE } from '../src/world/map.js';
import { findPath, pathToNeighbor } from '../src/player/pathfinding.js';
import { SPOTS, availableSpots, localDate } from '../src/collectibles.js';
import { NPCS, wanderStep, chestnutLines } from '../src/npc/dialogue.js';
import { createSave, normalizeSave, applyAction, shellsCollectedToday, SCHEMA } from '../src/state.js';

const walk = (x, y) => isWalkable(x, y);

test('地圖是 20×16，四周是海，包含小屋、廣場、樹林、沙灘', () => {
  assert.equal(MAP_W, 20); assert.equal(MAP_H, 16);
  const r = rows();
  assert.equal(r.length, MAP_H);
  r.forEach((row, i) => assert.equal(row.length, MAP_W, 'row ' + i));
  for (let x = 0; x < MAP_W; x++) { assert.equal(tileAt(x, 0).id, 'water'); assert.equal(tileAt(x, MAP_H - 1).id, 'water'); }
  const ids = new Set(r.join('').split('').map((c, i) => tileAt(i % MAP_W, Math.floor(i / MAP_W)).id));
  for (const id of ['house', 'plaza', 'forest', 'tree', 'sand']) assert.ok(ids.has(id), id);
  assert.ok(walk(SPAWN.x, SPAWN.y));
  assert.ok(walk(HOUSE.door.x, HOUSE.door.y));
});

test('房屋、樹、海不可走；超出邊界不可走', () => {
  assert.equal(walk(HOUSE.x, HOUSE.y), false);
  assert.equal(walk(-1, 3), false);
  assert.equal(walk(0, 0), false);
  assert.equal(walk(12, 1), false); // 樹
});

test('A* 繞過房屋，每一步都相鄰且可走', () => {
  const start = { x: 4, y: 3 }, goal = { x: 8, y: 3 };
  const p = findPath(start, goal, walk, MAP_W, MAP_H);
  assert.ok(p && p.length > 4, '必須繞路');
  let prev = start;
  for (const s of p) {
    assert.equal(Math.abs(s.x - prev.x) + Math.abs(s.y - prev.y), 1);
    assert.ok(walk(s.x, s.y));
    assert.ok(!(s.x >= HOUSE.x && s.x < HOUSE.x + HOUSE.w && s.y >= HOUSE.y && s.y < HOUSE.y + HOUSE.h));
    prev = s;
  }
  assert.deepEqual(p[p.length - 1], goal);
});

test('A* 目標是障礙物時回傳 null；原地回傳空陣列', () => {
  assert.equal(findPath(SPAWN, { x: 0, y: 0 }, walk, MAP_W, MAP_H), null);
  assert.deepEqual(findPath(SPAWN, SPAWN, walk, MAP_W, MAP_H), []);
});

test('pathToNeighbor 走到居民旁邊而不是居民身上', () => {
  const npc = NPCS[0].home;
  const r = pathToNeighbor(SPAWN, npc, (x, y) => walk(x, y) && !(x === npc.x && y === npc.y), MAP_W, MAP_H);
  assert.ok(r);
  assert.equal(Math.abs(r.stand.x - npc.x) + Math.abs(r.stand.y - npc.y), 1);
});

test('海灘 3 個貝殼都在可走的沙灘上，且玩家走得到', () => {
  assert.equal(SPOTS.length, 3);
  for (const s of SPOTS) {
    assert.equal(tileAt(s.x, s.y).id, 'sand', s.id);
    assert.ok(findPath(SPAWN, s, walk, MAP_W, MAP_H), s.id);
  }
});

test('同一個採集點同一天只給一次；隔天重新出現', () => {
  const s = createSave();
  const d1 = '2026-10-30', d2 = '2026-10-31';
  const a = applyAction(s, { type: 'collect', spotId: 'beach-shell-1', date: d1 });
  assert.equal(a.ok, true); assert.equal(a.total, 1);
  const b = applyAction(s, { type: 'collect', spotId: 'beach-shell-1', date: d1 });
  assert.equal(b.ok, false); assert.equal(b.reason, 'already'); assert.equal(b.changed, false);
  assert.equal(s.inventory.materials.shell, 1);
  assert.equal(availableSpots(s, d1).length, 2);
  assert.equal(shellsCollectedToday(s, d1), 1);
  assert.equal(availableSpots(s, d2).length, 3);
  applyAction(s, { type: 'collect', spotId: 'beach-shell-1', date: d2 });
  assert.equal(s.inventory.materials.shell, 2);
  assert.deepEqual(Object.keys(s.collected), [d2], '舊日期紀錄被清掉');
});

test('未知採集點不給獎', () => {
  const s = createSave();
  assert.equal(applyAction(s, { type: 'collect', spotId: 'nope', date: '2026-10-30' }).ok, false);
  assert.equal(s.inventory.materials.shell, 0);
});

test('位置只記錄可走的安全格', () => {
  const s = createSave();
  assert.equal(applyAction(s, { type: 'move', x: HOUSE.x, y: HOUSE.y, facing: 'up' }).ok, false);
  assert.equal(applyAction(s, { type: 'move', x: 3, y: 13, facing: 'left' }).changed, true);
  assert.deepEqual([s.player.x, s.player.y, s.player.facing], [3, 13, 'left']);
});

test('存檔正規化：壞資料回預設、不安全位置回出生點、保留新手家具', () => {
  assert.equal(normalizeSave(null).schema, SCHEMA);
  assert.equal(normalizeSave({ schema: 'other' }).inventory.materials.shell, 0);
  const n = normalizeSave({ schema: SCHEMA, player: { x: 0, y: 0, facing: 'x', outfit: 'zzz' }, inventory: { materials: { shell: 4, wood: -2 } } });
  assert.deepEqual([n.player.x, n.player.y, n.player.facing, n.player.outfit], [SPAWN.x, SPAWN.y, 'down', 'leaf']);
  assert.equal(n.inventory.materials.shell, 4);
  assert.equal(n.inventory.materials.wood, 0);
  assert.equal(createSave().inventory.furniture['starter-stool'], 1);
});

test('對話：第一次打招呼才算改變，同一天再聊不重複', () => {
  const s = createSave();
  assert.equal(applyAction(s, { type: 'talk', npcId: 'chestnut', date: '2026-10-30' }).talkedToday, false);
  const again = applyAction(s, { type: 'talk', npcId: 'chestnut', date: '2026-10-30' });
  assert.equal(again.talkedToday, true); assert.equal(again.changed, false);
  assert.ok(chestnutLines({ shellsToday: 3, shellsTotalToday: 3, talkedToday: true }).some(l => l.includes('都被你找到')));
});

test('居民只在家附近走動', () => {
  const n = NPCS[0];
  let pos = { ...n.home }, i = 0;
  const rand = () => ((i++ * 0.37) % 1);
  for (let k = 0; k < 200; k++) {
    const to = wanderStep(n, pos, walk, rand);
    if (to) pos = to;
    assert.ok(Math.abs(pos.x - n.home.x) + Math.abs(pos.y - n.home.y) <= n.range);
    assert.ok(walk(pos.x, pos.y));
  }
});

test('localDate 使用本機日期', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
